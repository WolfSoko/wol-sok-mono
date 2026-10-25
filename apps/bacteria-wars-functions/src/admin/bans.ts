import type { BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentReference,
  FieldValue,
  type Firestore,
  type Query,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { setHidden } from '../boards/entries';
import { takeDownPublic } from '../gallery/publish';
import type { Realtime } from './realtime';
import { noticeData, tombstoneData, writeAudit } from './records';

/**
 * Bans (ADR 0012): `bans/{uid}` = `{ since, until, reason }`, mirrored to
 * the Realtime Database's `bans/{uid}` as the end in ms (`0` for good).
 * Both are written here only. A ban ends by itself at `until` wherever it
 * is checked; the hourly run only cleans up after it (`expireBans`).
 */

/** A ban as stored, in ms. */
export interface BanState {
  since: number;
  /** Its end, null for good. */
  until: number | null;
  reason: BanReason;
}

/** The documents one page of a clear-out deletes. */
const PAGE = 300;

/**
 * The expired bans one hourly run lifts at most, before its verification
 * slice; the next run takes the rest.
 */
export const BAN_SWEEP_LIMIT = 25;

/** A ban as Firestore keeps it, in `bans/{uid}` and in the audit. */
export interface StoredBan {
  since: Timestamp;
  until: Timestamp | null;
  reason: BanReason;
}

function stored(ban: BanState): StoredBan {
  return {
    since: Timestamp.fromMillis(ban.since),
    until: ban.until === null ? null : Timestamp.fromMillis(ban.until),
    reason: ban.reason,
  };
}

/** A ban as the Realtime Database mirrors it: its end in ms, `0` for good. */
function realtimeBan(until: number | null): number {
  return until ?? 0;
}

/** True when a Realtime Database ban value still holds at `now`. */
function holdsInRealtime(value: unknown, now: number): boolean {
  return typeof value === 'number' && endHolds(value === 0 ? null : value, now);
}

/** The player's ban, also one that ended but is not cleaned up yet. */
export async function readBan(
  db: Firestore,
  uid: string
): Promise<BanState | null> {
  return banOf((await db.doc(`bans/${uid}`).get()).data());
}

/** A ban (or a tombstone, which keeps its end and reason) as stored. */
export function banOf(
  data: Record<string, unknown> | undefined
): BanState | null {
  if (data === undefined) {
    return null;
  }
  const { since, until, reason } = data;
  return {
    since: since instanceof Timestamp ? since.toMillis() : 0,
    until: until instanceof Timestamp ? until.toMillis() : null,
    reason: reason as BanReason,
  };
}

/** True while a ban holds at `now` - inclusive at its end, like the rules. */
export function holds(ban: BanState | null, now: number): boolean {
  return ban !== null && endHolds(ban.until, now);
}

function endHolds(until: number | null, now: number): boolean {
  return until === null || until > now;
}

/** What a ban or an unban changed, for the audit. */
export interface BanChange {
  before: StoredBan | null;
  after: StoredBan | null;
}

/**
 * Bans a player (`player.ban`), or changes the end and reason of a ban
 * that holds. In order (ADR 0012):
 * 1. in one transaction: `bans/{uid}`, and for a new ban the notice
 *    `banned` and the count in `moderation/{uid}.bans` - so a ban sent
 *    again after a failure is neither untold nor counted twice;
 * 2. the Realtime Database's ban, so its rules refuse the player too;
 * 3. takes the player out of what others meet them in: their queue entry,
 *    status and connection, the open rooms they host and the invites they
 *    made. A room already taken stays: its stub is what the other
 *    player's report of the match is checked against. Challenges expire
 *    within the hour and point to the player's rooms; friend requests
 *    lead nowhere while the player can write nothing;
 * 4. hides their entries on every board (`hiddenBy.ban`);
 * 5. takes their public replays down the way `remove` does.
 * Steps 2 to 5 change nothing the second time, so a ban sent again
 * finishes what a failed one left. For a Google account (`tombstone`, its
 * id), step 1 also writes the ban's tombstone, so the ban survives
 * deleting the account.
 */
export async function banPlayer(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  until: number | null,
  reason: BanReason,
  noticeId: string,
  now: number,
  { tombstone = null }: { tombstone?: string | null } = {}
): Promise<BanChange> {
  const banRef = db.doc(`bans/${uid}`);
  const { before, after } = await db.runTransaction(async (tx) => {
    const before = banOf((await tx.get(banRef)).data());
    // A ban that holds keeps its start; one that ended counts as new.
    const renewed = before !== null && holds(before, now);
    const after: BanState = {
      since: renewed ? before.since : now,
      until,
      reason,
    };
    tx.set(banRef, stored(after));
    if (tombstone !== null) {
      tx.set(
        db.doc(`banTombstones/${tombstone}`),
        tombstoneData(until, reason, now)
      );
    }
    if (!renewed) {
      tx.set(
        db.doc(`players/${uid}/notices/${noticeId}`),
        noticeData('banned', now, { until, reason })
      );
    }
    // The count, and every tombstone id the ban wrote, for the unban: it
    // finds them even once the player unlinked or swapped Google.
    if (!renewed || tombstone !== null) {
      tx.set(
        db.doc(`moderation/${uid}`),
        {
          ...(renewed ? {} : { bans: FieldValue.increment(1) }),
          ...(tombstone === null
            ? {}
            : { tombstones: FieldValue.arrayUnion(tombstone) }),
        },
        { merge: true }
      );
    }
    return { before, after };
  });
  await realtime.set(`bans/${uid}`, realtimeBan(until));
  await clearOut(db, realtime, uid);
  await changeBanHide(db, uid, null);
  await takeDownPublicReplays(db, uid, now);
  return {
    before: before === null ? null : stored(before),
    after: stored(after),
  };
}

/**
 * Lifts a player's ban (`player.unban`, or `expireBans` once it ended):
 * removes the Realtime Database's ban, brings back the entries the ban hid
 * - not those the owner hid or the player opted out of - and then, in one
 * transaction, deletes `bans/{uid}` and tells the player (notice
 * `unbanned`). The Firestore ban goes last, so a step that fails leaves it
 * for the next try. With `endedUntil`, only an ended ban with that end is
 * lifted. Every step is tied to the ban it read, so a ban the owner sets
 * while this runs keeps all of it: the Realtime Database value is removed
 * only when it is the lifted ban's or holds no more, each entry is
 * unhidden only while no other ban holds, and `bans/{uid}` is deleted only
 * while unchanged (`ban-changed` otherwise), together with the Google
 * account's tombstone (`tombstone`, its id, and those the ban noted in
 * `moderation/{uid}.tombstones`). Public replays taken down
 * stay down. An unban without a ban (`not-banned`) still removes the
 * Realtime Database's ban and unhides the entries, the owner's way to
 * repair a mirror a failed command left behind; a ban set meanwhile keeps
 * its mirror and hides all the same.
 */
export async function liftBan(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  noticeId: string,
  now: number,
  {
    endedUntil,
    tombstone = null,
  }: { endedUntil?: number; tombstone?: string | null } = {}
): Promise<BanChange | 'not-banned' | 'ban-changed'> {
  const before = await readBan(db, uid);
  if (before === null) {
    if (endedUntil === undefined) {
      // Removes only the value it saw, and only while Firestore holds no
      // ban: a ban set meanwhile is committed before its mirror is written,
      // so either it is read here or its mirror is not the value seen.
      const mirrored = await realtime.get(`bans/${uid}`);
      if (mirrored !== null && !holds(await readBan(db, uid), now)) {
        await realtime.removeIf(`bans/${uid}`, (value) => value === mirrored);
      }
      await changeBanHide(db, uid, { lifted: null, now });
    }
    return 'not-banned';
  }
  if (
    endedUntil !== undefined &&
    (holds(before, now) || before.until !== endedUntil)
  ) {
    return 'ban-changed';
  }
  const value = realtimeBan(before.until);
  await realtime.removeIf(
    `bans/${uid}`,
    (current) => current === value || !holdsInRealtime(current, now)
  );
  await changeBanHide(db, uid, { lifted: before, now });
  const ref = db.doc(`bans/${uid}`);
  const moderation = db.doc(`moderation/${uid}`);
  const lifted = await db.runTransaction(async (tx) => {
    const [ban, counts] = await tx.getAll(ref, moderation);
    if (!sameBan(banOf(ban?.data()), before)) {
      return false;
    }
    tx.delete(ref);
    const noted = notedTombstones(counts?.data());
    for (const id of new Set([...noted, tombstone])) {
      if (id !== null) {
        tx.delete(db.doc(`banTombstones/${id}`));
      }
    }
    if (noted.length > 0) {
      tx.update(moderation, { tombstones: FieldValue.delete() });
    }
    tx.set(
      db.doc(`players/${uid}/notices/${noticeId}`),
      noticeData('unbanned', now)
    );
    return true;
  });
  return lifted ? { before: stored(before), after: null } : 'ban-changed';
}

/** The tombstone ids a player's bans noted in `moderation/{uid}`. */
export function notedTombstones(
  moderation: Record<string, unknown> | undefined
): string[] {
  const ids: unknown = moderation?.['tombstones'];
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : [];
}

function sameBan(a: BanState | null, b: BanState): boolean {
  return (
    a !== null &&
    a.since === b.since &&
    a.until === b.until &&
    a.reason === b.reason
  );
}

/**
 * The hourly clean-up (ADR 0012): lifts the bans whose `until` has passed,
 * the oldest first and {@link BAN_SWEEP_LIMIT} at most, each audited with
 * `by: 'system'`. One that fails is logged and left for the next run; the
 * others go on.
 */
export async function expireBans(
  db: Firestore,
  realtime: Realtime,
  now: number
): Promise<number> {
  // A range on `until` leaves out the permanent bans, whose `until` is null.
  const ended = await db
    .collection('bans')
    .where('until', '<=', Timestamp.fromMillis(now))
    .orderBy('until', 'asc')
    .limit(BAN_SWEEP_LIMIT)
    .get();
  let lifted = 0;
  for (const doc of ended.docs) {
    const uid = doc.id;
    const until = (doc.get('until') as Timestamp).toMillis();
    const id = `ban-ended_${uid}_${until}`;
    try {
      // Its tombstones go by the ids the ban noted, else by TTL.
      const change = await liftBan(db, realtime, uid, id, now, {
        endedUntil: until,
      });
      if (typeof change === 'string') {
        continue;
      }
      await writeAudit(
        db,
        id,
        {
          by: 'system',
          type: 'player.unban',
          target: { uid },
          reason: 'ban ended',
          ...change,
          ok: true,
          source: 'system',
        },
        now
      );
      lifted++;
    } catch (error) {
      logger.error('Could not lift an ended ban', { uid, error });
    }
  }
  return lifted;
}

/**
 * Adds (`unhide` null) or takes away the `ban` reason on each of the
 * player's entries (`setHidden`). Taking it away is for the ban `lifted`
 * (null: none is left), so an entry stays hidden while another ban holds:
 * a ban set meanwhile keeps what it hid, whichever of the two gets to the
 * entry first. Returns how many entries changed.
 */
function changeBanHide(
  db: Firestore,
  uid: string,
  unhide: { lifted: BanState | null; now: number } | null
): Promise<number> {
  return setHidden(
    db,
    uid,
    'ban',
    unhide === null,
    unhide === null
      ? {}
      : {
          guard: {
            ref: db.doc(`bans/${uid}`),
            keeps: (data) => {
              const ban = banOf(data);
              return (
                holds(ban, unhide.now) &&
                (unhide.lifted === null || !sameBan(ban, unhide.lifted))
              );
            },
          },
        }
  );
}

/** Takes a banned player out of what others meet them in - see `banPlayer`. */
async function clearOut(
  db: Firestore,
  realtime: Realtime,
  uid: string
): Promise<void> {
  await db.doc(`queue/${uid}`).delete();
  await realtime.remove(`status/${uid}`);
  await realtime.remove(`connections/${uid}`);
  const rooms = await db
    .collection('rooms')
    .where('host', '==', uid)
    .select('taken')
    .get();
  await deleteRefs(
    db,
    rooms.docs.filter((doc) => doc.get('taken') !== true).map((doc) => doc.ref)
  );
  await deleteAll(db, db.collection('invites').where('from', '==', uid));
}

async function deleteAll(db: Firestore, query: Query): Promise<void> {
  for (;;) {
    const page = await query.select().limit(PAGE).get();
    await deleteRefs(
      db,
      page.docs.map((doc) => doc.ref)
    );
    if (page.size < PAGE) {
      return;
    }
  }
}

async function deleteRefs(
  db: Firestore,
  refs: readonly DocumentReference[]
): Promise<void> {
  for (let i = 0; i < refs.length; i += PAGE) {
    const batch = db.batch();
    refs.slice(i, i + PAGE).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Takes the player's public replays down the way `remove` does (ADR 0011):
 * the public copy gets `removedAt` (`takeDownPublic`), and the stored replay keeps the player
 * in `optOut` with `galleryOut`, so it never comes back. Filtered on
 * `removedAt` here, so the query needs no composite index.
 */
async function takeDownPublicReplays(
  db: Firestore,
  uid: string,
  now: number
): Promise<void> {
  const published = await db
    .collection('publicReplays')
    .where('uids', 'array-contains', uid)
    .get();
  for (const doc of published.docs) {
    const removedAt: unknown = doc.get('removedAt');
    if (removedAt !== null && removedAt !== undefined) {
      continue;
    }
    // The stored replay first: a public copy marked removed is skipped
    // next time, so it must be the last step.
    const replayId = doc.get('replayId');
    const replay =
      typeof replayId === 'string' ? db.doc(`replays/${replayId}`) : null;
    if (replay !== null && (await replay.get()).exists) {
      await replay.update({
        optOut: FieldValue.arrayUnion(uid),
        galleryOut: true,
      });
    }
    await takeDownPublic(db, doc, now);
  }
}
