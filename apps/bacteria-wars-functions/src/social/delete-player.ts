import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { isRealtimeKey, type Realtime } from '../admin/realtime';
import { deleteAll, deleteRefs, openRoomsOf } from '../deletes';
import { settleAll } from '../settle';

/** What `deletePlayerSocial` went through - for the log and the specs. */
export interface SocialErased {
  /** The players whose lists were cleared of this one. */
  others: number;
  /** The documents outside `players/{uid}` it deleted. */
  deleted: number;
}

/** The lists of `players/{owner}` that may name another player by id. */
const LISTS = ['friends', 'requests', 'challenges'] as const;

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
    // An id that cannot be a key has no mirror entry, and would fail the
    // whole update - an erase that never succeeds.
    if (!isRealtimeKey(other)) {
      logger.warn('No Realtime Database key: its mirror entries skipped', {
        uid,
        other,
      });
      continue;
    }
    mirrors[`statusReaders/${other}/${uid}`] = null;
    mirrors[`listedBy/${other}/${uid}`] = null;
  }
  const [, , invites, rooms] = await settleAll([
    deleteRefs(db, refs),
    db.recursiveDelete(player),
    deleteAll(db, db.collection('invites').where('from', '==', uid)),
    openRoomsOf(db, uid, ['host', 'guest']).then((open) =>
      deleteRefs(db, open)
    ),
    realtime.update(mirrors),
  ]);
  return { others: others.size, deleted: refs.length + invites + rooms };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
