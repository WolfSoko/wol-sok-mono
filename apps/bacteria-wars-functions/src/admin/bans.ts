import { BAN_REASONS, type BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import { createHmac } from 'node:crypto';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';
import { banHolds, banUntil } from '../limits';
import type { AdminDeps } from './deps';
import { setHidden } from './hide';
import {
  bumpModeration,
  claimAudit,
  settleAudit,
  writeNotice,
} from './notices';

/** How long a tombstone outlives a deleted account at most. */
const TOMBSTONE_MAX_MS = 2 * 365 * DAY_MS;
/** Bans the hourly function lifts side by side. */
const EXPIRE_PARALLEL = 10;

/** A ban's end as stored: a timestamp, or null for good. */
const endOf = (until: number | null) =>
  until === null ? null : Timestamp.fromMillis(until);

/**
 * The key of a ban tombstone (ADR 0012): HMAC-SHA256 of the account's
 * Google provider uid with `BAN_TOMBSTONE_KEY`, so it can neither be
 * reversed nor guessed from outside.
 */
export function tombstoneId(googleUid: string, key: string): string {
  return createHmac('sha256', key).update(googleUid).digest('hex');
}

/** What a ban changed, for the audit. */
export interface BanResult {
  before: { until: number | null; reason: string } | null;
  after: { until: number | null; reason: BanReason };
}

/**
 * Bans a player (ADR 0012), or changes the end and reason of a ban that
 * holds. A new ban (or one whose end has passed) also takes the player
 * out of what others see: their queue entry, online status, hosted rooms
 * and invites, and their entries on every board (`hiddenBy: 'ban'`). A
 * Google account gets a tombstone, so a deleted and recreated account is
 * banned again. The rules read `bans/{uid}`, so the ban holds at once;
 * the functions' 60 s cache per instance catches up. Refresh tokens are
 * not revoked, which would only hand a guest a fresh account.
 *
 * `googleUid`, when the caller knows it, saves the Auth lookup;
 * `tombstone: false` skips the tombstone (it came from one).
 */
export async function banPlayer(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  until: number | null,
  reason: BanReason,
  now: number,
  noticeId: string,
  known: { googleUid?: string | null; tombstone?: boolean } = {}
): Promise<BanResult> {
  const banRef = db.doc(`bans/${uid}`);
  const [snapshot, googleUid] = await Promise.all([
    banRef.get(),
    known.googleUid !== undefined
      ? known.googleUid
      : deps.account(uid).then((account) => account?.googleUid ?? null),
  ]);
  const stored = snapshot.data();
  const before =
    stored === undefined
      ? null
      : { until: banUntil(stored), reason: String(stored['reason']) };
  // A ban whose end has passed no longer holds, though the hourly
  // function has not lifted it yet: banning again is a new ban.
  const holds = before !== null && banHolds(before.until, now);
  await Promise.all([
    banRef.set({
      since: holds ? stored?.['since'] : Timestamp.fromMillis(now),
      until: endOf(until),
      reason,
    }),
    deps.rtdb.set(`bans/${uid}`, until ?? 0),
    googleUid !== null && known.tombstone !== false
      ? writeTombstone(db, deps, googleUid, until, reason, now)
      : null,
    writeNotice(
      db,
      uid,
      noticeId,
      { type: 'banned', until: endOf(until), reason },
      now
    ),
    ...(holds
      ? []
      : [
          db.doc(`queue/${uid}`).delete(),
          deps.rtdb.remove(`status/${uid}`),
          deps.rtdb.remove(`connections/${uid}`),
          deleteWhere(db, 'rooms', 'host', uid),
          deleteWhere(db, 'invites', 'from', uid),
          setHidden(db, uid, 'ban', true),
          bumpModeration(db, uid, 'bans'),
        ]),
  ]);
  return { before, after: { until, reason } };
}

/**
 * Lifts a ban (ADR 0012): both ban documents and the tombstone go, the
 * entries hidden by the ban come back (not those the owner hid or barred,
 * nor a player's own opt-out). Public replays taken down stay down. False
 * when there was no ban; `banned: true` says the caller has seen one.
 */
export async function unbanPlayer(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  now: number,
  noticeId: string,
  known: { banned?: true } = {}
): Promise<boolean> {
  const banRef = db.doc(`bans/${uid}`);
  if (known.banned !== true && !(await banRef.get()).exists) {
    return false;
  }
  await Promise.all([
    banRef.delete(),
    deps.rtdb.remove(`bans/${uid}`),
    deps
      .account(uid)
      .then((account) =>
        account?.googleUid
          ? db
              .doc(
                `banTombstones/${tombstoneId(account.googleUid, deps.tombstoneKey())}`
              )
              .delete()
          : null
      ),
    setHidden(db, uid, 'ban', false),
    writeNotice(db, uid, noticeId, { type: 'unbanned' }, now),
  ]);
  return true;
}

/** Keeps a banned Google identity banned past the account's deletion. */
export async function writeTombstone(
  db: Firestore,
  deps: AdminDeps,
  googleUid: string,
  until: number | null,
  reason: string,
  now: number
): Promise<void> {
  await db
    .doc(`banTombstones/${tombstoneId(googleUid, deps.tombstoneKey())}`)
    .set({
      until: endOf(until),
      reason,
      expireAt: Timestamp.fromMillis(
        Math.min(until ?? Infinity, now + TOMBSTONE_MAX_MS)
      ),
    });
}

/**
 * Bans a new uid again when its Google identity has a tombstone that still
 * holds (ADR 0012) - true when it did. The audit says `system`.
 */
export async function applyTombstone(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  googleUid: string,
  now: number
): Promise<boolean> {
  const id = tombstoneId(googleUid, deps.tombstoneKey());
  const tombstone = (await db.doc(`banTombstones/${id}`).get()).data();
  const until = banUntil(tombstone);
  if (tombstone === undefined || !banHolds(until, now)) {
    return false;
  }
  const reason = (BAN_REASONS as readonly string[]).includes(
    String(tombstone['reason'])
  )
    ? (tombstone['reason'] as BanReason)
    : 'other';
  const auditId = `tombstone_${uid}`;
  const claim = {
    by: 'system',
    type: 'player.ban',
    target: { uid },
    reason: 'tombstone',
    source: 'system' as const,
  };
  if (!(await claimAudit(db, auditId, claim, now))) {
    return false;
  }
  const result = await banPlayer(db, deps, uid, until, reason, now, auditId, {
    googleUid,
    tombstone: false,
  });
  await settleAudit(db, auditId, { ok: true, ...result });
  return true;
}

/**
 * The hourly clean-up (ADR 0012): bans whose end has passed are lifted -
 * they stopped holding at `until` already, wherever they are checked.
 */
export async function expireBans(
  db: Firestore,
  deps: AdminDeps,
  now: number
): Promise<number> {
  const ended = await db
    .collection('bans')
    .where('until', '<=', Timestamp.fromMillis(now))
    .limit(100)
    .get();
  const lift = async (uid: string, until: number | null) => {
    // One audit per ban: a second run for the same end does nothing.
    const auditId = `unban_${uid}_${until}`;
    const claim = {
      by: 'system',
      type: 'player.unban',
      target: { uid },
      reason: 'expired',
      source: 'system' as const,
    };
    if (await claimAudit(db, auditId, claim, now)) {
      await unbanPlayer(db, deps, uid, now, auditId, { banned: true });
      await settleAudit(db, auditId, {
        ok: true,
        before: { until },
        after: null,
      });
    }
  };
  for (let i = 0; i < ended.docs.length; i += EXPIRE_PARALLEL) {
    await Promise.all(
      ended.docs
        .slice(i, i + EXPIRE_PARALLEL)
        .map((doc) => lift(doc.id, banUntil(doc.data())))
    );
  }
  return ended.size;
}

async function deleteWhere(
  db: Firestore,
  collection: string,
  field: string,
  uid: string
): Promise<void> {
  const found = await db
    .collection(collection)
    .where(field, '==', uid)
    .select()
    .get();
  await Promise.all(found.docs.map((doc) => doc.ref.delete()));
}
