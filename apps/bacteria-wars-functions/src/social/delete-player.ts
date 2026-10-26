import type {
  DocumentReference,
  Firestore,
  Query,
} from 'firebase-admin/firestore';
import type { Realtime } from '../admin/realtime';

/** What `deletePlayerSocial` went through - for the log and the specs. */
export interface SocialErased {
  /** The players whose lists were cleared of this one. */
  others: number;
  /** The documents outside `players/{uid}` it deleted. */
  deleted: number;
}

/** The lists of `players/{owner}` that may name another player by id. */
const LISTS = ['friends', 'requests', 'challenges'] as const;

/** Documents a query deletes per page. */
const PAGE = 300;

/**
 * Erases what a deleted account leaves of its social and personal data
 * (ADR 0010, 0012, owner's decision of 2026-10-26), beside
 * `deletePlayerBoards` and `deletePlayerReplays`:
 * - everything under `players/{uid}` (stored progress and settings,
 *   friends, requests, challenges, attempts, notices) and `profiles/{uid}`;
 * - the player in other players' lists: `players/{other}/friends|requests|
 *   challenges/{uid}` for every other player this one lists, was asked or
 *   challenged by, or is listed by (the `listedBy` mirror,
 *   `social/mirror.ts` - a collection-group query cannot find a bare
 *   document id);
 * - `queue/{uid}`, the invites they made, the rooms nobody took that they
 *   host or answered (a taken room's stub stays, at most 6 hours: the
 *   other player's report is checked against it);
 * - in the Realtime Database `status/{uid}`, `connections/{uid}`, both
 *   mirrors of their lists, and their entries in other players' mirrors.
 * Idempotent, and runs for banned accounts too: a deletion must erase the
 * player's data. Throws when a step fails, after the others ran.
 */
export async function deletePlayerSocial(
  db: Firestore,
  realtime: Realtime,
  uid: string
): Promise<SocialErased> {
  const player = db.doc(`players/${uid}`);
  // Who else may hold this player in a list - read before anything goes.
  const [listed, ...lists] = await Promise.all([
    realtime.get(`listedBy/${uid}`),
    ...LISTS.map((list) => player.collection(list).listDocuments()),
  ]);
  const others = new Set([
    ...(isRecord(listed) ? Object.keys(listed) : []),
    ...lists.flatMap((refs) => refs.map((ref) => ref.id)),
  ]);
  others.delete(uid);
  const refs: DocumentReference[] = [
    db.doc(`profiles/${uid}`),
    db.doc(`queue/${uid}`),
    ...[...others].flatMap((other) =>
      LISTS.map((list) => db.doc(`players/${other}/${list}/${uid}`))
    ),
  ];
  const mirrors: Record<string, null> = {
    [`status/${uid}`]: null,
    [`connections/${uid}`]: null,
    [`statusReaders/${uid}`]: null,
    [`listedBy/${uid}`]: null,
  };
  for (const other of others) {
    mirrors[`statusReaders/${other}/${uid}`] = null;
    mirrors[`listedBy/${other}/${uid}`] = null;
  }
  const settled = await Promise.allSettled([
    deleteRefs(db, refs),
    db.recursiveDelete(player),
    deleteAll(db, db.collection('invites').where('from', '==', uid)),
    openRoomsOf(db, uid).then((rooms) => deleteRefs(db, rooms)),
    realtime.update(mirrors),
  ]);
  const failed = settled.find((result) => result.status === 'rejected');
  if (failed !== undefined) {
    throw failed.reason;
  }
  const [, , invites, rooms] = settled as PromiseFulfilledResult<number>[];
  return {
    others: others.size,
    deleted: refs.length + invites.value + rooms.value,
  };
}

/** The rooms nobody took yet that the player hosts or answered. */
async function openRoomsOf(
  db: Firestore,
  uid: string
): Promise<DocumentReference[]> {
  const rooms = db.collection('rooms');
  const [hosted, answered] = await Promise.all([
    rooms.where('host', '==', uid).select('taken').get(),
    rooms.where('guest', '==', uid).select('taken').get(),
  ]);
  return [
    ...new Map(
      [...hosted.docs, ...answered.docs]
        .filter((doc) => doc.get('taken') !== true)
        .map((doc) => [doc.id, doc.ref])
    ).values(),
  ];
}

async function deleteAll(db: Firestore, query: Query): Promise<number> {
  let deleted = 0;
  for (;;) {
    const page = await query.select().limit(PAGE).get();
    deleted += await deleteRefs(
      db,
      page.docs.map((doc) => doc.ref)
    );
    if (page.size < PAGE) {
      return deleted;
    }
  }
}

async function deleteRefs(
  db: Firestore,
  refs: readonly DocumentReference[]
): Promise<number> {
  for (let i = 0; i < refs.length; i += PAGE) {
    const batch = db.batch();
    refs.slice(i, i + PAGE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
