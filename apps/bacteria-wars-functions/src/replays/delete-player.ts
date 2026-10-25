import {
  type DocumentReference,
  FieldValue,
  type Firestore,
} from 'firebase-admin/firestore';
import { anonymisePublic } from '../gallery/publish';

/** Replays taken out of a deleted account at once. */
const PARALLEL_REPLAYS = 10;

/**
 * Takes a deleted account out of its replays (ADR 0011): a replay it was
 * the only player of goes with its blob and reports, one shared with
 * another player keeps that player and loses this one - from `players`,
 * from the room's `seats` and its report. That includes an online match
 * only the other player reported, which names the account in `seats`
 * alone. A replay the player took out of the gallery stays out
 * (`galleryOut`). Its public replays stay, without its uid and with the
 * colour label for its name (`anonymisePublic`). Runs for banned accounts
 * too: a deletion must erase the player's data.
 */
export async function deletePlayerReplays(
  db: Firestore,
  uid: string
): Promise<{ deleted: number; left: number; anonymised: number }> {
  // Its public replays at the same time: they hold no private replay.
  const anonymising = anonymisePublic(db, uid);
  const replays = db.collection('replays');
  // Each transaction reads its replay again: the queries need the ids only.
  const [played, seated] = await Promise.all([
    replays.where('players', 'array-contains', uid).select().get(),
    replays.where('seats', 'array-contains', uid).select().get(),
  ]);
  const refs = [
    ...new Map(
      [...played.docs, ...seated.docs].map((doc) => [doc.id, doc.ref])
    ).values(),
  ];
  const outcomes: ('gone' | 'only' | 'left')[] = [];
  // A few at a time - each touches its own replay - so a player with
  // a thousand replays fits the trigger's minute.
  for (let i = 0; i < refs.length; i += PARALLEL_REPLAYS) {
    outcomes.push(
      ...(await Promise.all(
        refs.slice(i, i + PARALLEL_REPLAYS).map((ref) => leave(db, ref, uid))
      ))
    );
  }
  const anonymised = await anonymising;
  return {
    deleted: outcomes.filter((o) => o === 'only').length,
    left: outcomes.filter((o) => o === 'left').length,
    anonymised,
  };
}

/**
 * Takes the account out of one replay, or deletes the replay it was the
 * only player of.
 */
async function leave(
  db: Firestore,
  ref: DocumentReference,
  uid: string
): Promise<'gone' | 'only' | 'left'> {
  // In a transaction: the seats are written back whole, and the other
  // player may be deleting their account at the same time.
  const outcome = await db.runTransaction(async (tx) => {
    const replay = await tx.get(ref);
    if (!replay.exists) {
      return 'gone' as const;
    }
    const players = replay.get('players');
    if (Array.isArray(players) && players.every((player) => player === uid)) {
      return 'only' as const;
    }
    const seats = replay.get('seats');
    tx.update(ref, {
      players: FieldValue.arrayRemove(uid),
      optOut: FieldValue.arrayRemove(uid),
      // The other player reads the replay: the seat forgets the uid too.
      ...(Array.isArray(seats)
        ? { seats: seats.map((seat) => (seat === uid ? null : seat)) }
        : {}),
    });
    tx.delete(ref.collection('reports').doc(uid));
    return 'left' as const;
  });
  if (outcome === 'only') {
    await db.recursiveDelete(ref);
  }
  return outcome;
}
