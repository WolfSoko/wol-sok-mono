import type {
  DocumentReference,
  Firestore,
  Query,
  QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { isRealtimeKey, type Realtime } from '../admin/realtime';

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
 * (TTL), so it has no mirror of its own. An id the Realtime Database
 * takes as no key (`isRealtimeKey`) is skipped and logged; the rules let
 * no client write one since 2026-10-26.
 */

/** The lists of `players/{owner}` that have a mirror. */
export type MirroredList = 'friends' | 'requests';

const MIRRORED: readonly MirroredList[] = ['friends', 'requests'];

/** How often `mirrorListing` writes again for an entry that keeps changing. */
const MIRROR_TRIES = 5;

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
 * not taken from the event, so events delivered late or twice leave the
 * mirror right - and reads it again after writing: when it changed
 * meanwhile, another event's handler may have written before this one,
 * so it writes again. Whichever handler writes last checks last, so two
 * events handled out of order (a create's write landing after the
 * delete's) still end on the entry as it is, and a write that lands after
 * an account deletion took the entry removes it again. Throws when the
 * entry keeps changing, for the trigger's retry. True when the entry
 * exists; false, and logged, for ids that cannot be keys.
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
  if (!isRealtimeKey(owner) || !isRealtimeKey(other)) {
    logger.warn('Friend list entry not mirrored: no Realtime Database key', {
      list,
      owner,
      other,
    });
    return false;
  }
  const ref = db.doc(`players/${owner}/${list}/${other}`);
  let exists = (await ref.get()).exists;
  for (let i = 0; i < MIRROR_TRIES; i++) {
    await realtime.update(mirrorPaths(list, owner, other, exists));
    const now = (await ref.get()).exists;
    if (now === exists) {
      return exists;
    }
    exists = now;
  }
  throw new Error(`players/${owner}/${list}/${other} kept changing`);
}

/** Entries a backfill reads and mirrors at once. */
const PAGE = 500;

/** What a backfill did - for the audit's `after`. */
export interface MirrorBackfill {
  /** The entries of each list it mirrored. */
  friends: number;
  requests: number;
  /** Mirror entries it removed, as no list entry stands behind them. */
  removed: number;
  /** List entries left out, as their ids cannot be keys. */
  skipped: number;
}

/**
 * Repairs the mirror from every player's `friends` and `requests` (the
 * admin's `presence.backfill`, once after the mirror's first deploy, and
 * whenever the owner doubts it): adds what is missing, page by page, then
 * removes what no list entry stands behind. The mirror is read before the
 * lists, so an entry a trigger writes meanwhile is not taken for a stale
 * one; and each stale one is checked against its list entry once more
 * right before it goes. Idempotent.
 */
export async function backfillMirrors(
  db: Firestore,
  realtime: Realtime
): Promise<MirrorBackfill> {
  const [readers, listed] = await Promise.all([
    realtime.get('statusReaders'),
    realtime.get('listedBy'),
  ]);
  const result: MirrorBackfill = {
    friends: 0,
    requests: 0,
    removed: 0,
    skipped: 0,
  };
  const mirrored = new Set<string>();
  for (const list of MIRRORED) {
    const first: Query = db.collectionGroup(list).select().limit(PAGE);
    let last: QueryDocumentSnapshot | undefined;
    do {
      const page = await (
        last === undefined ? first : first.startAfter(last)
      ).get();
      const values: Record<string, true> = {};
      for (const doc of page.docs) {
        const owner = playerOf(doc.ref);
        if (owner === null || owner === doc.id) {
          continue;
        }
        if (!isRealtimeKey(owner) || !isRealtimeKey(doc.id)) {
          logger.warn('Friend list entry not mirrored: no key', {
            path: doc.ref.path,
          });
          result.skipped++;
          continue;
        }
        for (const path of Object.keys(
          mirrorPaths(list, owner, doc.id, true)
        )) {
          values[path] = true;
          mirrored.add(path);
        }
        result[list]++;
      }
      await realtime.update(values);
      last = page.size < PAGE ? undefined : page.docs.at(-1);
    } while (last !== undefined);
  }
  const stale = [
    ...leaves('statusReaders', readers, 2),
    ...leaves('listedBy', listed, 3),
  ].filter((path) => !mirrored.has(path));
  for (let i = 0; i < stale.length; i += PAGE) {
    const paths = stale.slice(i, i + PAGE);
    const sources = paths.map((path) => sourceOf(db, path));
    const refs = sources.filter(
      (ref): ref is DocumentReference => ref !== null
    );
    const found = new Set(
      (refs.length === 0 ? [] : await db.getAll(...refs))
        .filter((doc) => doc.exists)
        .map((doc) => doc.ref.path)
    );
    const removals: Record<string, null> = {};
    paths.forEach((path, j) => {
      const source = sources[j];
      if (source === null || !found.has(source.path)) {
        removals[path] = null;
      }
    });
    await realtime.update(removals);
    result.removed += Object.keys(removals).length;
  }
  return result;
}

/** The owner of `players/{owner}/{list}/{id}` - null for another path. */
function playerOf(ref: DocumentReference): string | null {
  const owner = ref.parent.parent;
  return owner !== null &&
    owner.parent.id === 'players' &&
    owner.parent.parent === null
    ? owner.id
    : null;
}

/**
 * The paths of a mirror's entries `depth` levels below `root` - and of a
 * value found higher up, which is no entry. None when the mirror is empty.
 */
function leaves(root: string, tree: unknown, depth: number): string[] {
  const walk = (path: string, node: unknown, left: number): string[] =>
    left === 0 || !isRecord(node)
      ? [path]
      : Object.entries(node).flatMap(([key, child]) =>
          walk(`${path}/${key}`, child, left - 1)
        );
  return isRecord(tree) ? walk(root, tree, depth) : [];
}

/** The list entry a mirror's entry stands for - null for none. */
function sourceOf(db: Firestore, path: string): DocumentReference | null {
  const [root, ...keys] = path.split('/');
  // Firestore reserves ids like `__x__`; no list entry has one.
  if (keys.some((key) => /^__.*__$/.test(key))) {
    return null;
  }
  if (root === 'statusReaders' && keys.length === 2) {
    const [owner, reader] = keys;
    return db.doc(`players/${owner}/friends/${reader}`);
  }
  if (root === 'listedBy' && keys.length === 3) {
    const [uid, owner, list] = keys;
    return (MIRRORED as readonly string[]).includes(list)
      ? db.doc(`players/${owner}/${list}/${uid}`)
      : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
