import type { BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentReference,
  FieldValue,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import {
  entryData,
  hiddenByOf,
  memberEntries,
  profileIn,
} from '../boards/entries';
import { clearBanCache } from '../limits';
import type { Realtime } from './realtime';
import { writeAudit, writeNotice } from './records';

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

/** The expired bans one hourly run lifts at most; the next takes the rest. */
export const BAN_SWEEP_LIMIT = 100;

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

/** The player's ban, also one that ended but is not cleaned up yet. */
export async function readBan(
  db: Firestore,
  uid: string
): Promise<BanState | null> {
  return banOf((await db.doc(`bans/${uid}`).get()).data());
}

function banOf(data: Record<string, unknown> | undefined): BanState | null {
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
  return ban !== null && (ban.until === null || ban.until > now);
}

/** What a ban or an unban changed, for the audit. */
export interface BanChange {
  before: StoredBan | null;
  after: StoredBan | null;
}

/**
 * Bans a player (`player.ban`), or changes the end and reason of a ban
 * that holds. In order (ADR 0012):
 * 1. writes both ban documents, so the rules refuse the player's writes
 *    while the rest runs;
 * 2. takes the player out of what others meet them in: their queue entry,
 *    status and connection, the rooms they host, the invites they made,
 *    the challenges they sent and the friend requests they left;
 * 3. hides their entries on every board (`hiddenBy.ban`);
 * 4. takes their public replays down the way `remove` does;
 * 5. for a new ban only, tells them (notice `banned`) and counts it
 *    (`moderation/{uid}.bans`).
 * Steps 2 to 4 change nothing the second time, so a changed ban runs them
 * again and finishes what a failed command left. Ban tombstones come with
 * a later wave.
 */
export async function banPlayer(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  until: number | null,
  reason: BanReason,
  noticeId: string,
  now: number
): Promise<BanChange> {
  const before = await readBan(db, uid);
  // A ban that holds keeps its start; one that ended counts as new.
  const renewed = before !== null && holds(before, now);
  const after: BanState = {
    since: renewed ? before.since : now,
    until,
    reason,
  };
  await db.doc(`bans/${uid}`).set(stored(after));
  await realtime.set(`bans/${uid}`, until ?? 0);
  clearBanCache();
  const change = {
    before: before === null ? null : stored(before),
    after: stored(after),
  };
  // Idempotent, so a ban sent again finishes what a failed one left.
  await clearOut(db, realtime, uid);
  await hideForBan(db, uid, true);
  await takeDownPublicReplays(db, uid);
  if (!renewed) {
    await writeNotice(db, uid, noticeId, 'banned', now, { until, reason });
    await db
      .doc(`moderation/${uid}`)
      .set({ bans: FieldValue.increment(1) }, { merge: true });
  }
  return change;
}

/**
 * Lifts a player's ban (`player.unban`, or `expireBans` once it ended):
 * brings back the entries the ban hid - not those the owner hid or the
 * player opted out of - tells the player (notice `unbanned`) and deletes
 * both ban documents. Public replays taken down stay down. With
 * `endedOnly`, only a ban whose end has passed is lifted. The Firestore
 * ban goes last, and only while it is the ban this started from: a step
 * that fails leaves it for the next try, and a ban the owner renewed
 * meanwhile stays. Null when there was nothing to lift.
 */
export async function liftBan(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  noticeId: string,
  now: number,
  endedOnly = false
): Promise<BanChange | null> {
  const before = await readBan(db, uid);
  if (before === null || (endedOnly && holds(before, now))) {
    return null;
  }
  await realtime.remove(`bans/${uid}`);
  await hideForBan(db, uid, false);
  await writeNotice(db, uid, noticeId, 'unbanned', now);
  const ref = db.doc(`bans/${uid}`);
  const lifted = await db.runTransaction(async (tx) => {
    const ban = banOf((await tx.get(ref)).data());
    if (ban === null || ban.until !== before.until) {
      return false;
    }
    tx.delete(ref);
    return true;
  });
  clearBanCache();
  return lifted ? { before: stored(before), after: null } : null;
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
    const id = `ban-ended_${uid}_${(doc.get('until') as Timestamp).toMillis()}`;
    try {
      const change = await liftBan(db, realtime, uid, id, now, true);
      if (change === null) {
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
 * Adds or takes away the `ban` reason on each of the player's entries
 * (`boardMembers/{uid}`), one transaction per entry, keeping what else
 * hides it. Updated in place, so a daily entry keeps its `expireAt`.
 * Returns how many entries changed.
 */
export async function hideForBan(
  db: Firestore,
  uid: string,
  hide: boolean
): Promise<number> {
  const member = await db.doc(`boardMembers/${uid}`).get();
  let changed = 0;
  for (const { boardId, entryId } of memberEntries(member.data())) {
    const ref = db.doc(`boards/${boardId}/entries/${entryId}`);
    const done = await db.runTransaction(async (tx) => {
      const entry = await tx.get(ref);
      const data = entry.data();
      if (data === undefined) {
        return false;
      }
      const hiddenBy = hiddenByOf(data['hiddenBy']);
      if ((hiddenBy.ban === true) === hide) {
        return false;
      }
      if (hide) {
        hiddenBy.ban = true;
      } else {
        delete hiddenBy.ban;
      }
      const profile = await profileIn(tx, db, uid);
      tx.update(
        ref,
        entryData(
          entryId,
          {
            sort: data['sort'],
            atHour: data['atHour'],
            baseStatus: data['baseStatus'] ?? data['status'],
            show: data['show'],
          },
          profile,
          hiddenBy
        )
      );
      return true;
    });
    changed += done ? 1 : 0;
  }
  return changed;
}

/**
 * Takes a banned player out of what others meet them in. Challenges and
 * friend requests are keyed by their sender's uid, and a collection-group
 * query cannot filter on a document id alone (it needs the whole path), so
 * those two groups are read through without their fields: challenges
 * expire within the hour, and bans are rare.
 */
async function clearOut(
  db: Firestore,
  realtime: Realtime,
  uid: string
): Promise<void> {
  await db.doc(`queue/${uid}`).delete();
  await realtime.remove(`status/${uid}`);
  await realtime.remove(`connections/${uid}`);
  await deleteAll(db, db.collection('rooms').where('host', '==', uid));
  await deleteAll(db, db.collection('invites').where('from', '==', uid));
  await deleteSentBy(db, 'challenges', uid);
  await deleteSentBy(db, 'requests', uid);
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

async function deleteSentBy(
  db: Firestore,
  group: 'challenges' | 'requests',
  uid: string
): Promise<void> {
  const sent: DocumentReference[] = [];
  for await (const doc of db.collectionGroup(group).select().stream()) {
    const snapshot = doc as unknown as QueryDocumentSnapshot;
    if (snapshot.id === uid) {
      sent.push(snapshot.ref);
    }
  }
  await deleteRefs(db, sent);
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
 * the public copy gets `removedAt`, and the stored replay keeps the player
 * in `optOut` with `galleryOut`, so it never comes back. Filtered on
 * `removedAt` here, so the query needs no composite index.
 */
async function takeDownPublicReplays(
  db: Firestore,
  uid: string
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
    await doc.ref.update({ removedAt: FieldValue.serverTimestamp() });
    const replayId = doc.get('replayId');
    if (typeof replayId !== 'string') {
      continue;
    }
    const replay = db.doc(`replays/${replayId}`);
    if ((await replay.get()).exists) {
      await replay.update({
        optOut: FieldValue.arrayUnion(uid),
        galleryOut: true,
      });
    }
  }
}
