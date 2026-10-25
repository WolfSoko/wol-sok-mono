import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { changeAccounts } from '../admin/accounts';
import { holds, readBan } from '../admin/bans';
import type { Realtime } from '../admin/realtime';
import { scrubAudit, tombstoneData } from '../admin/records';
import { memberEntries } from './entries';

/**
 * Erases a deleted account's board data (ADR 0012). First, for a banned
 * account with a Google provider (`tombstone`, its tombstone id), writes
 * the ban's tombstone, so the ban survives the deletion. Then deletes its
 * entry on every board it is on (`boardMembers/{uid}.boards`), which
 * `rebuildTop` then takes off the top documents; its `dailyRuns` (one per
 * daily board) and `endlessRuns`; `boardMembers`, `limits`, `moderation`
 * and both ban documents; its declared attempts and notices. Scrubs the
 * audit entries about it and lowers `stats/accounts`. Runs for banned
 * accounts too: a deletion must erase the player's data. Throws when a
 * step fails, after the others ran; returns the board documents it went
 * through.
 */
export async function deletePlayerBoards(
  db: Firestore,
  uid: string,
  { tombstone, realtime }: { tombstone: string | null; realtime: Realtime },
  now: number
): Promise<number> {
  const ban = await readBan(db, uid);
  if (tombstone !== null && ban !== null && holds(ban, now)) {
    await db
      .doc(`banTombstones/${tombstone}`)
      .set(tombstoneData(ban.until, ban.reason, now));
  }
  const memberRef = db.doc(`boardMembers/${uid}`);
  const [member, runs] = await Promise.all([
    memberRef.get(),
    db.collection('endlessRuns').where('uid', '==', uid).select().get(),
  ]);
  const refs: DocumentReference[] = [
    ...runs.docs.map((doc) => doc.ref),
    memberRef,
    db.doc(`limits/${uid}`),
    db.doc(`moderation/${uid}`),
    db.doc(`bans/${uid}`),
  ];
  for (const { boardId, board, entryId } of memberEntries(member.data())) {
    if (board.kind === 'daily') {
      refs.push(db.doc(`dailyRuns/${board.day}_${uid}`));
    }
    refs.push(db.doc(`boards/${boardId}/entries/${entryId}`));
  }
  const writer = db.bulkWriter();
  const deletes = refs.map((ref) => writer.delete(ref));
  // Every delete runs, then the first failure is told.
  const settled = await Promise.allSettled([
    ...deletes,
    writer.close(),
    db.recursiveDelete(db.collection(`players/${uid}/attempts`)),
    db.recursiveDelete(db.collection(`players/${uid}/notices`)),
    realtime.remove(`bans/${uid}`),
    scrubAudit(db, uid),
    changeAccounts(db, -1, now),
  ]);
  const failed = settled.find((result) => result.status === 'rejected');
  if (failed !== undefined) {
    throw failed.reason;
  }
  return refs.length;
}
