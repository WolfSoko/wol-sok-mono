import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Takes a deleted account out of its replays (ADR 0011): a replay it was
 * the only player of goes with its blob and reports, one shared with
 * another player keeps that player and loses this one - from `players`,
 * from the room's `seats` and its report. That includes an online match
 * only the other player reported, which names the account in `seats`
 * alone. Runs for banned accounts too: a deletion must erase the player's
 * data.
 */
export async function deletePlayerReplays(
  db: Firestore,
  uid: string
): Promise<{ deleted: number; left: number }> {
  const replays = db.collection('replays');
  const [played, seated] = await Promise.all([
    replays.where('players', 'array-contains', uid).get(),
    replays.where('seats', 'array-contains', uid).get(),
  ]);
  const found = new Map(
    [...played.docs, ...seated.docs].map((doc) => [doc.id, doc])
  );
  let deleted = 0;
  let left = 0;
  for (const replay of found.values()) {
    const players = replay.get('players');
    const seats = replay.get('seats');
    if (Array.isArray(players) && players.every((player) => player === uid)) {
      await db.recursiveDelete(replay.ref);
      deleted++;
    } else {
      await replay.ref.update({
        players: FieldValue.arrayRemove(uid),
        optOut: FieldValue.arrayRemove(uid),
        // The other player reads the replay: the seat forgets the uid too.
        ...(Array.isArray(seats)
          ? { seats: seats.map((seat) => (seat === uid ? null : seat)) }
          : {}),
      });
      await replay.ref.collection('reports').doc(uid).delete();
      left++;
    }
  }
  return { deleted, left };
}
