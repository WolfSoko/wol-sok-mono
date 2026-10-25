import { createHmac } from 'node:crypto';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';
import { clearBanCache } from '../limits';
import type { AdminDeps } from './deps';
import { setHidden } from './hide';
import { writeAudit, writeNotice } from './notices';

/** Why a player was banned - shown to them as a category. */
export type BanReason = 'cheating' | 'offensive-profile' | 'spam' | 'other';
export const BAN_REASONS: readonly BanReason[] = [
  'cheating',
  'offensive-profile',
  'spam',
  'other',
];

/** How long a tombstone outlives a deleted account at most. */
const TOMBSTONE_MAX_MS = 2 * 365 * DAY_MS;

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
 * holds. On a new ban it also takes the player out of what others see:
 * their queue entry, online status, hosted rooms and invites, and their
 * entries on every board (`hiddenBy: 'ban'`). A Google account gets a
 * tombstone, so a deleted and recreated account is banned again. The
 * rules read `bans/{uid}`, so the ban holds at once; refresh tokens are
 * not revoked, which would only hand a guest a fresh account.
 */
export async function banPlayer(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  until: number | null,
  reason: BanReason,
  now: number,
  noticeId: string
): Promise<BanResult> {
  const banRef = db.doc(`bans/${uid}`);
  const stored = (await banRef.get()).data();
  const before =
    stored === undefined
      ? null
      : {
          until:
            stored['until'] instanceof Timestamp
              ? stored['until'].toMillis()
              : null,
          reason: String(stored['reason']),
        };
  await banRef.set({
    since: stored?.['since'] ?? Timestamp.fromMillis(now),
    until: until === null ? null : Timestamp.fromMillis(until),
    reason,
  });
  await deps.rtdb.set(`bans/${uid}`, until ?? 0);
  clearBanCache();
  const account = await deps.account(uid);
  if (account?.googleUid) {
    await writeTombstone(db, deps, account.googleUid, until, reason, now);
  }
  if (before === null) {
    await Promise.all([
      db.doc(`queue/${uid}`).delete(),
      deps.rtdb.remove(`status/${uid}`),
      deps.rtdb.remove(`connections/${uid}`),
      deleteWhere(db, 'rooms', 'host', uid),
      deleteWhere(db, 'invites', 'from', uid),
      setHidden(db, uid, 'ban', true),
      db
        .doc(`moderation/${uid}`)
        .set({ bans: FieldValue.increment(1) }, { merge: true }),
    ]);
  }
  await writeNotice(
    db,
    uid,
    noticeId,
    {
      type: 'banned',
      until: until === null ? null : Timestamp.fromMillis(until),
      reason,
    },
    now
  );
  return { before, after: { until, reason } };
}

/**
 * Lifts a ban (ADR 0012): both ban documents and the tombstone go, the
 * entries hidden by the ban come back (not those the owner hid or barred,
 * nor a player's own opt-out). Public replays taken down stay down.
 */
export async function unbanPlayer(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  now: number,
  noticeId: string
): Promise<boolean> {
  const banRef = db.doc(`bans/${uid}`);
  if (!(await banRef.get()).exists) {
    return false;
  }
  await banRef.delete();
  await deps.rtdb.remove(`bans/${uid}`);
  clearBanCache();
  const account = await deps.account(uid);
  if (account?.googleUid) {
    await db
      .doc(
        `banTombstones/${tombstoneId(account.googleUid, deps.tombstoneKey())}`
      )
      .delete();
  }
  await setHidden(db, uid, 'ban', false);
  await writeNotice(db, uid, noticeId, { type: 'unbanned' }, now);
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
  const end = Math.min(until ?? Infinity, now + TOMBSTONE_MAX_MS);
  await db
    .doc(`banTombstones/${tombstoneId(googleUid, deps.tombstoneKey())}`)
    .set({
      until: until === null ? null : Timestamp.fromMillis(until),
      reason,
      expireAt: Timestamp.fromMillis(end),
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
  if (tombstone === undefined) {
    return false;
  }
  const until =
    tombstone['until'] instanceof Timestamp
      ? tombstone['until'].toMillis()
      : null;
  if (until !== null && until <= now) {
    return false;
  }
  const reason = BAN_REASONS.includes(tombstone['reason'] as BanReason)
    ? (tombstone['reason'] as BanReason)
    : 'other';
  const auditId = `tombstone_${uid}`;
  const result = await banPlayer(db, deps, uid, until, reason, now, auditId);
  await writeAudit(
    db,
    auditId,
    {
      by: 'system',
      type: 'player.ban',
      target: { uid },
      reason: 'tombstone',
      before: result.before,
      after: result.after,
      ok: true,
      source: 'system',
    },
    now
  );
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
  for (const doc of ended.docs) {
    const auditId = `unban_${doc.id}_${now}`;
    if (await unbanPlayer(db, deps, doc.id, now, auditId)) {
      await writeAudit(
        db,
        auditId,
        {
          by: 'system',
          type: 'player.unban',
          target: { uid: doc.id },
          reason: 'expired',
          before: { until: (doc.get('until') as Timestamp).toMillis() },
          after: null,
          ok: true,
          source: 'system',
        },
        now
      );
    }
  }
  return ended.size;
}

async function deleteWhere(
  db: Firestore,
  collection: string,
  field: string,
  uid: string
): Promise<void> {
  const found = await db.collection(collection).where(field, '==', uid).get();
  await Promise.all(found.docs.map((doc) => doc.ref.delete()));
}
