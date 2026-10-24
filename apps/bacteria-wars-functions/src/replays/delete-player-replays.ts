import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { inBatches } from '../firestore';
import type { PublicSeat } from './model';

/** Replays handled per page of the deletion. */
const PAGE = 200;

/** What deleting an account did to the replays. */
export interface DeletedReplays {
  /** Replays the player was the only player of: gone. */
  deleted: number;
  /** Replays the other player keeps, without the deleted uid. */
  kept: number;
  /** Public replays that lost the player's name. */
  unnamed: number;
}

/**
 * `deletePlayerReplays` (ADR 0011), on account deletion: replays the player
 * was the only player of are deleted with their blob and reports; from the
 * rest the uid and its report are removed; in public replays the name falls
 * back to the colour label and the uid goes. The player's limits go too.
 * Never checks a ban: a banned player's deletion must erase their data.
 */
export async function deletePlayerReplays(
  db: Firestore,
  uid: string
): Promise<DeletedReplays> {
  const result: DeletedReplays = { deleted: 0, kept: 0, unnamed: 0 };
  for (;;) {
    const page = await db
      .collection('replays')
      .where('players', 'array-contains', uid)
      .limit(PAGE)
      .get();
    if (page.empty) {
      break;
    }
    for (const doc of page.docs) {
      const players = doc.get('players') as string[];
      if (players.every((player) => player === uid)) {
        await db.recursiveDelete(doc.ref);
        result.deleted++;
      } else {
        const batch = db.batch();
        batch.update(doc.ref, { players: FieldValue.arrayRemove(uid) });
        batch.delete(doc.ref.collection('reports').doc(uid));
        await batch.commit();
        result.kept++;
      }
    }
  }

  const published = await db
    .collection('publicReplays')
    .where('uids', 'array-contains', uid)
    .get();
  await inBatches(db, published.docs, (batch, doc) => {
    const seats = doc.get('seatUids') as (string | null)[];
    batch.update(doc.ref, {
      uids: FieldValue.arrayRemove(uid),
      seatUids: seats.map((seat) => (seat === uid ? null : seat)),
      players: (doc.get('players') as PublicSeat[]).map((player, seat) =>
        seats[seat] === uid ? { ...player, name: null } : player
      ),
    });
  });
  result.unnamed = published.size;
  await db.doc(`limits/${uid}`).delete();
  return result;
}
