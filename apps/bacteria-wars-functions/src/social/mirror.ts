import type { Firestore, Query } from 'firebase-admin/firestore';
import type { Realtime } from '../admin/realtime';

/**
 * The friend lists' mirrors in the Realtime Database (ADR 0012, owner's
 * decision of 2026-10-26), written by the functions only - the database
 * rules let no client read or write them:
 * - `statusReaders/{owner}/{reader}: true` while `players/{owner}/friends/
 *   {reader}` exists: whom the owner lists as a friend, so the rules of
 *   `status/{owner}` can let only those read it (that rule ships once
 *   this mirror is deployed and backfilled);
 * - `listedBy/{uid}/{owner}/{list}: true` while `players/{owner}/{list}/
 *   {uid}` exists, for `friends` and `requests`: where a player appears in
 *   other players' lists, which a collection-group query cannot find by a
 *   bare document id - for the account deletion (`deletePlayerSocial`).
 * A friend's challenge needs the friendship and expires within the hour
 * (TTL), so it has no mirror of its own.
 */

/** The lists of `players/{owner}` that have a mirror. */
export type MirroredList = 'friends' | 'requests';

const MIRRORED: readonly MirroredList[] = ['friends', 'requests'];

/** The mirror's values for one entry of a list - `null` removes them. */
export function mirrorPaths(
  list: MirroredList,
  owner: string,
  other: string,
  exists: boolean
): Record<string, true | null> {
  const value = exists ? true : null;
  return {
    ...(list === 'friends'
      ? { [`statusReaders/${owner}/${other}`]: value }
      : {}),
    [`listedBy/${other}/${owner}/${list}`]: value,
  };
}

/**
 * Mirrors `players/{owner}/{list}/{other}` as it stands now - read afresh,
 * not taken from the event, so events delivered late or out of order, or
 * twice, all leave the mirror right. True when the entry exists.
 */
export async function mirrorListing(
  db: Firestore,
  realtime: Realtime,
  list: MirroredList,
  owner: string,
  other: string
): Promise<boolean> {
  if (owner === other) {
    return false;
  }
  const exists = (await db.doc(`players/${owner}/${list}/${other}`).get())
    .exists;
  await realtime.update(mirrorPaths(list, owner, other, exists));
  return exists;
}

/** Entries a backfill reads and mirrors at once. */
const PAGE = 500;

/**
 * Mirrors every entry of every player's `friends` and `requests` (the
 * admin's `presence.backfill`, once after the mirror's first deploy, and
 * whenever the owner doubts it): adds what is missing, page by page, and
 * returns how many entries of each list it mirrored. Idempotent; it
 * removes nothing, as the triggers mirror every removal since their
 * deploy.
 */
export async function backfillMirrors(
  db: Firestore,
  realtime: Realtime
): Promise<Record<MirroredList, number>> {
  const counts: Record<MirroredList, number> = { friends: 0, requests: 0 };
  for (const list of MIRRORED) {
    let query: Query = db.collectionGroup(list).select().limit(PAGE);
    for (;;) {
      const page = await query.get();
      const values: Record<string, true | null> = {};
      for (const doc of page.docs) {
        // `players/{owner}/{list}/{other}` only - not a list of that name
        // anywhere else.
        const owner = doc.ref.parent.parent;
        if (
          owner === null ||
          owner.parent.id !== 'players' ||
          owner.parent.parent !== null ||
          owner.id === doc.id
        ) {
          continue;
        }
        Object.assign(values, mirrorPaths(list, owner.id, doc.id, true));
        counts[list]++;
      }
      await realtime.update(values);
      const last = page.docs.at(-1);
      if (page.size < PAGE || last === undefined) {
        break;
      }
      query = db.collectionGroup(list).select().startAfter(last).limit(PAGE);
    }
  }
  return counts;
}
