import type { DocumentReference } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { isRealtimeKey } from '../admin/realtime';
import { deleteRefs, openRoomsOf } from '../deletes';
import type { Stores } from '../erasure/context';
import { eraseListed } from '../erasure/erase-listed';
import { settleAll } from '../settle';

/** What `deletePlayerSocial` went through - for the log and the specs. */
export type SocialErased = {
  /** The players whose lists were cleared of this one. */
  others: number;
  /** The documents outside `players/{uid}` it deleted. */
  deleted: number;
};

/** The lists of `players/{owner}` that may name another player by id. */
const LISTS = ['friends', 'requests', 'challenges'] as const;

/**
 * The `social` part of the erasure (`erasePart`): what a deleted account
 * leaves of its social and personal data (ADR 0010, 0012, owner's
 * decision of 2026-10-26):
 * - what `PLAYER_DATA` lists of the part (`eraseListed`): everything under
 *   `players/{uid}` (stored progress and settings, friends, requests,
 *   challenges, attempts, notices), `profiles/{uid}`, `queue/{uid}`, the
 *   invites they made, and in the Realtime Database `status/{uid}`,
 *   `connections/{uid}` and both mirrors of their lists;
 * - the player in other players' lists: `players/{other}/friends|requests|
 *   challenges/{uid}` for every other player this one lists, was asked or
 *   challenged by, or is listed by (the `listedBy` mirror,
 *   `social/mirror.ts` - a collection-group query cannot find a bare
 *   document id), and their entries in those players' mirrors;
 * - the rooms nobody took that they host or answered (a taken room's stub
 *   stays, at most 6 hours: the other player's report is checked against
 *   it).
 * Idempotent, and runs for banned accounts too: a deletion must erase the
 * player's data. Throws when a step fails, after the others ran.
 */
export async function deletePlayerSocial(
  stores: Stores,
  uid: string
): Promise<SocialErased> {
  const { db, realtime } = stores;
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
  const refs: DocumentReference[] = [...others].flatMap((other) =>
    LISTS.map((list) => db.doc(`players/${other}/${list}/${uid}`))
  );
  const mirrors: string[] = [];
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
    mirrors.push(`statusReaders/${other}/${uid}`, `listedBy/${other}/${uid}`);
  }
  const [othersLists, own, rooms] = await settleAll([
    deleteRefs(db, refs),
    // Their own nodes and their entries in others' mirrors: one update.
    eraseListed(stores, uid, 'social', { alsoRemove: mirrors }),
    openRoomsOf(db, uid, ['host', 'guest']).then((open) =>
      deleteRefs(db, open)
    ),
  ]);
  return { others: others.size, deleted: othersLists + own + rooms };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
