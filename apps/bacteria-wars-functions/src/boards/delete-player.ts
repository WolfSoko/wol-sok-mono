import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { ACCOUNTS_DOC, accountsChange } from '../admin/accounts';
import { holds, readBan } from '../admin/bans';
import type { Realtime } from '../admin/realtime';
import { scrubAudit, tombstoneData } from '../admin/records';
import { memberEntries } from './entries';

/**
 * Erases a deleted account's board data (ADR 0012): its entry on every
 * board it is on (`boardMembers/{uid}.boards`), which `rebuildTop` then
 * takes off the top documents; its `dailyRuns` (one per daily board) and
 * `endlessRuns`; `boardMembers`, `limits` and `moderation`; its declared
 * attempts and notices. Scrubs the audit entries about it and lowers
 * `stats/accounts` if `countAccount` counted it. Both ban documents go
 * once a banned account's tombstone is written - by the id of its Google
 * provider (`tombstone`), or the one its ban noted - so the ban survives
 * the deletion. Runs for banned accounts too: a deletion must erase the
 * player's data. Throws when a step fails, after the others ran; returns
 * the board documents it went through.
 */
export async function deletePlayerBoards(
  db: Firestore,
  uid: string,
  { tombstone, realtime }: { tombstone: string | null; realtime: Realtime },
  now: number
): Promise<number> {
  const memberRef = db.doc(`boardMembers/${uid}`);
  const moderationRef = db.doc(`moderation/${uid}`);
  const [member, moderation, runs] = await Promise.all([
    memberRef.get(),
    moderationRef.get(),
    db.collection('endlessRuns').where('uid', '==', uid).select().get(),
  ]);
  const refs: DocumentReference[] = [
    ...runs.docs.map((doc) => doc.ref),
    memberRef,
    db.doc(`limits/${uid}`),
    moderationRef,
  ];
  for (const { boardId, board, entryId } of memberEntries(member.data())) {
    if (board.kind === 'daily') {
      refs.push(db.doc(`dailyRuns/${board.day}_${uid}`));
    }
    refs.push(db.doc(`boards/${boardId}/entries/${entryId}`));
  }
  const noted: unknown = moderation.get('tombstone');
  const tombstoneId = tombstone ?? (typeof noted === 'string' ? noted : null);
  const writer = db.bulkWriter();
  const deletes = refs.map((ref) => writer.delete(ref));
  // Every step runs, then the first failure is told.
  const settled = await Promise.allSettled([
    ...deletes,
    writer.close(),
    db.recursiveDelete(db.collection(`players/${uid}/attempts`)),
    db.recursiveDelete(db.collection(`players/${uid}/notices`)),
    scrubAudit(db, uid),
    member.get('accountCounted') === true
      ? db.doc(ACCOUNTS_DOC).set(accountsChange(-1, now), { merge: true })
      : undefined,
    keepAsTombstone(db, uid, tombstoneId, now).then(() =>
      Promise.all([
        db.doc(`bans/${uid}`).delete(),
        realtime.remove(`bans/${uid}`),
      ])
    ),
  ]);
  const failed = settled.find((result) => result.status === 'rejected');
  if (failed !== undefined) {
    throw failed.reason;
  }
  return refs.length;
}

/** Writes a banned account's tombstone (by `id`) while its ban holds. */
async function keepAsTombstone(
  db: Firestore,
  uid: string,
  id: string | null,
  now: number
): Promise<void> {
  const ban = await readBan(db, uid);
  if (id !== null && ban !== null && holds(ban, now)) {
    await db
      .doc(`banTombstones/${id}`)
      .set(tombstoneData(ban.until, ban.reason, now));
  }
}
