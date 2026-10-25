import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { memberEntries } from './entries';

/**
 * Erases a deleted account's board data (ADR 0012): its entry on every
 * board it is on (`boardMembers/{uid}.boards`), which `rebuildTop` then
 * takes off the top documents; its `dailyRuns` (one per daily board) and
 * `endlessRuns`; `boardMembers`, `limits` and `moderation`; its declared
 * attempts and notices. Runs for banned accounts too: a deletion must erase the player's data. Its
 * ban and audit entries stay until the ban tombstones come. Throws when a delete
 * fails, after the others ran; returns the board documents it went
 * through.
 */
export async function deletePlayerBoards(
  db: Firestore,
  uid: string
): Promise<number> {
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
  ]);
  const failed = settled.find((result) => result.status === 'rejected');
  if (failed !== undefined) {
    throw failed.reason;
  }
  return refs.length;
}
