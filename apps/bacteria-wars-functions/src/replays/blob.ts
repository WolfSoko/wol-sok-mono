import type {
  DocumentData,
  DocumentReference,
  Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import type { Engine } from '../engine';

/** A batch or a transaction - both create documents alike. */
interface Creator {
  create(ref: DocumentReference, data: DocumentData): unknown;
}

/**
 * Stores a replay's bytes beside it, `replays/{id}/blob/data`, with the
 * replay's `expireAt`: TTL deletes no subcollection with its parent, so
 * the blob expires itself.
 */
export function addBlob(
  batch: Creator,
  db: Firestore,
  replayId: string,
  bytes: Uint8Array,
  expireAt: Timestamp | undefined
): void {
  batch.create(db.doc(`replays/${replayId}/blob/data`), {
    bytes: Buffer.from(bytes),
    size: bytes.length,
    ...(expireAt === undefined ? {} : { expireAt }),
  });
}

/**
 * The stored replay of `replays/{id}`, read from its blob - undefined
 * when there is no blob (it expired), null when the bytes hold no replay.
 */
export async function readStoredReplay(
  db: Firestore,
  engine: Pick<Engine, 'replayFromBytes'>,
  replayId: string
): Promise<Replay | null | undefined> {
  const blob = await db.doc(`replays/${replayId}/blob/data`).get();
  const bytes = blob.get('bytes') as Uint8Array | undefined;
  return bytes === undefined
    ? undefined
    : engine.replayFromBytes(new Uint8Array(bytes), { stored: true });
}
