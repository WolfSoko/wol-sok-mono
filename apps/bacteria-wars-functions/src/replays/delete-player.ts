import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Takes a deleted account out of its replays (ADR 0011): a replay it was
 * the only player of goes with its blob and reports, one shared with
 * another player keeps that player and loses this one. Runs for banned
 * accounts too: a deletion must erase the player's data.
 */
export async function deletePlayerReplays(
  db: Firestore,
  uid: string
): Promise<{ deleted: number; left: number }> {
  const replays = await db
    .collection('replays')
    .where('players', 'array-contains', uid)
    .get();
  let deleted = 0;
  let left = 0;
  for (const replay of replays.docs) {
    const players = replay.get('players');
    if (Array.isArray(players) && players.every((player) => player === uid)) {
      await db.recursiveDelete(replay.ref);
      deleted++;
    } else {
      await replay.ref.update({
        players: FieldValue.arrayRemove(uid),
        optOut: FieldValue.arrayRemove(uid),
      });
      await replay.ref.collection('reports').doc(uid).delete();
      left++;
    }
  }
  return { deleted, left };
}
