import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { memberEntries } from './entries';

/**
 * The board documents of a deleted account the player data map cannot
 * name by path (ADR 0012, `PLAYER_DATA`): its entry on every board it is
 * on (`boardMembers/{uid}.boards`), which `rebuildTop` then takes off the
 * top documents, and its `dailyRuns` (one per daily board). Read before
 * `boardMembers/{uid}` goes; `deleteAccount` deletes them.
 */
export async function boardRefsOf(
  db: Firestore,
  uid: string
): Promise<DocumentReference[]> {
  const member = await db.doc(`boardMembers/${uid}`).get();
  return memberEntries(member.data()).flatMap(({ boardId, board, entryId }) => [
    ...(board.kind === 'daily'
      ? [db.doc(`dailyRuns/${board.day}_${uid}`)]
      : []),
    db.doc(`boards/${boardId}/entries/${entryId}`),
  ]);
}
