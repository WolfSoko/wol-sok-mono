import {
  type BoardKind,
  parseBoardId,
} from '@wolsok/feat-lazy-bac-game/engine';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

/**
 * Erases a deleted account's board data (ADR 0012): its entry on every
 * board it is on (`boardMembers/{uid}.boards`), which `rebuildTop` then
 * takes off the top documents; its `dailyRuns` (one per daily board) and
 * `endlessRuns`; `boardMembers`, `limits` and `moderation`; its declared
 * attempts and notices. Runs for banned accounts too: a deletion must
 * erase the player's data. The ban and its tombstone come with the admin
 * commands.
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
  const boards = member.get('boards');
  const entryIds = (member.get('entryIds') ?? {}) as Partial<
    Record<BoardKind, string>
  >;
  const refs: DocumentReference[] = [
    ...runs.docs.map((doc) => doc.ref),
    memberRef,
    db.doc(`limits/${uid}`),
    db.doc(`moderation/${uid}`),
  ];
  for (const boardId of Array.isArray(boards) ? boards : []) {
    const board = typeof boardId === 'string' ? parseBoardId(boardId) : null;
    const entryId = board === null ? undefined : entryIds[board.kind];
    if (entryId !== undefined) {
      refs.push(db.doc(`boards/${boardId}/entries/${entryId}`));
    }
    if (board?.kind === 'daily') {
      refs.push(db.doc(`dailyRuns/${board.day}_${uid}`));
    }
  }
  const writer = db.bulkWriter();
  for (const ref of refs) {
    void writer.delete(ref);
  }
  await Promise.all([
    writer.close(),
    db.recursiveDelete(db.collection(`players/${uid}/attempts`)),
    db.recursiveDelete(db.collection(`players/${uid}/notices`)),
  ]);
  return refs.length;
}
