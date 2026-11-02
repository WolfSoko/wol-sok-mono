import type { Firestore } from 'firebase-admin/firestore';

/**
 * Deletes what a deleted `replays/{id}` leaves behind: its blob and its
 * reports. TTL removes the replay document alone (30 days after the
 * match), and nothing else would ever reach these again.
 */
export async function deleteReplayChildren(
  db: Firestore,
  replayId: string
): Promise<void> {
  const replay = db.doc(`replays/${replayId}`);
  await Promise.all([
    db.recursiveDelete(replay.collection('blob')),
    db.recursiveDelete(replay.collection('reports')),
  ]);
}
