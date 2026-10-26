import { createHmac } from 'node:crypto';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { clearBanCache } from '../limits';
import { banOf, banPlayer, holds, readBan } from './bans';
import type { Realtime } from './realtime';
import { writeAudit } from './records';

/**
 * Ban tombstones (ADR 0012): a ban survives deleting a Google account.
 * `banTombstones/{id}` = `{ until, reason, expireAt }`, keyed by an
 * HMAC-SHA256 of the account's `google.com` provider uid with the server
 * secret `BAN_TOMBSTONE_KEY`, so the key can be neither reversed nor
 * guessed from outside. Written with the ban and when a banned account is
 * deleted; checked when an account signs up with Google, and once after a
 * guest links Google. Read by functions only, and gone with the ban (TTL).
 */

/** The parts of an Auth user a tombstone is keyed by. */
export interface ProviderInfo {
  providerData: readonly { providerId: string; uid: string }[];
}

/** An account's Google provider, undefined for one without. */
export function googleProviderOf<P extends { providerId: string }>(user: {
  providerData: readonly P[];
}): P | undefined {
  return user.providerData.find((p) => p.providerId === 'google.com');
}

/**
 * The tombstone id of an account - null for one without a Google
 * provider, which no tombstone can follow.
 */
export function tombstoneId(key: string, user: ProviderInfo): string | null {
  const google = googleProviderOf(user);
  return google === undefined
    ? null
    : createHmac('sha256', key).update(google.uid).digest('hex');
}

/**
 * Bans the account behind `uid` again when its Google identity's tombstone
 * (`id`) holds, audited with `by: 'system'` - unless a ban holds for it
 * already, which stays as it is - and notes the check
 * (`boardMembers/{uid}.googleChecked`). True when it banned.
 */
export async function applyTombstone(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  id: string,
  now: number
): Promise<boolean> {
  const banned = await banByTombstone(db, realtime, uid, id, now);
  await db
    .doc(`boardMembers/${uid}`)
    .set({ googleChecked: true }, { merge: true });
  return banned;
}

async function banByTombstone(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  id: string,
  now: number
): Promise<boolean> {
  const tombstone = banOf((await db.doc(`banTombstones/${id}`).get()).data());
  if (
    tombstone === null ||
    !holds(tombstone, now) ||
    holds(await readBan(db, uid), now)
  ) {
    return false;
  }
  const { until, reason } = tombstone;
  const commandId = `tombstone_${uid}`;
  const change = await banPlayer(
    db,
    realtime,
    uid,
    until,
    reason,
    commandId,
    now,
    { tombstone: id }
  );
  await writeAudit(
    db,
    commandId,
    {
      by: 'system',
      type: 'player.ban',
      target: { uid },
      reason: 'ban tombstone',
      ...change,
      ok: true,
      source: 'system',
    },
    now
  );
  // This instance may have cached the player as not banned.
  clearBanCache();
  return true;
}

/** How often a guest's account is looked up for a Google link. */
export const GOOGLE_LINK_CHECK_MS = 60 * 60_000;

/**
 * The one-time tombstone check after a guest links Google (ADR 0012), for
 * `rankProgress` and `acceptReplay`: until `boardMembers/{uid}` notes
 * `googleChecked`, looks the account up (`tombstoneOf`, null while it has
 * no Google provider) and applies its tombstone, then notes the check. A
 * guest is looked up once an hour at most (`googleLookedAt`), not on every
 * write - noted only on a membership that exists: every account has one
 * (`countAccount`, `stats.recount`), and a write that comes after its
 * account's deletion must not bring it back. True when it banned.
 */
export async function checkGoogleLink(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  tombstoneOf: (uid: string) => Promise<string | null>,
  now: number
): Promise<boolean> {
  const member = db.doc(`boardMembers/${uid}`);
  const data = (await member.get()).data();
  const lookedAt: unknown = data?.['googleLookedAt'];
  if (
    data?.['googleChecked'] === true ||
    (lookedAt instanceof Timestamp &&
      now - lookedAt.toMillis() < GOOGLE_LINK_CHECK_MS)
  ) {
    return false;
  }
  const id = await tombstoneOf(uid);
  if (id === null) {
    if (data !== undefined) {
      await member.update({ googleLookedAt: Timestamp.fromMillis(now) });
    }
    return false;
  }
  return applyTombstone(db, realtime, uid, id, now);
}
