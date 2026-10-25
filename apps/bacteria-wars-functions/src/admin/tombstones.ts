import { createHmac } from 'node:crypto';
import type { BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { clearBanCache } from '../limits';
import { banPlayer, holds, readBan } from './bans';
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

/**
 * The tombstone id of an account - null for one without a Google
 * provider, which no tombstone can follow.
 */
export function tombstoneId(key: string, user: ProviderInfo): string | null {
  const google = user.providerData.find((p) => p.providerId === 'google.com');
  return google === undefined
    ? null
    : createHmac('sha256', key).update(google.uid).digest('hex');
}

/**
 * Bans the account behind `uid` again when its Google identity's tombstone
 * (`id`) holds, audited with `by: 'system'` - unless a ban holds for it
 * already, which stays as it is. True when it banned.
 */
export async function applyTombstone(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  id: string,
  now: number
): Promise<boolean> {
  const tombstone = (await db.doc(`banTombstones/${id}`).get()).data();
  if (tombstone === undefined) {
    return false;
  }
  const until =
    tombstone['until'] instanceof Timestamp
      ? tombstone['until'].toMillis()
      : null;
  const reason = tombstone['reason'] as BanReason;
  if ((until !== null && until <= now) || holds(await readBan(db, uid), now)) {
    return false;
  }
  const commandId = `tombstone_${uid}`;
  const change = await banPlayer(
    db,
    realtime,
    uid,
    until,
    reason,
    commandId,
    id,
    now
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

/**
 * The one-time tombstone check after a guest links Google (ADR 0012), for
 * `rankProgress` and `acceptReplay`: until `boardMembers/{uid}` notes
 * `googleChecked`, looks the account up (`tombstoneOf`, null while it has
 * no Google provider) and applies its tombstone, then notes the check.
 * True when it banned.
 */
export async function checkGoogleLink(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  tombstoneOf: (uid: string) => Promise<string | null>,
  now: number
): Promise<boolean> {
  const member = db.doc(`boardMembers/${uid}`);
  if ((await member.get()).get('googleChecked') === true) {
    return false;
  }
  const id = await tombstoneOf(uid);
  if (id === null) {
    return false;
  }
  const banned = await applyTombstone(db, realtime, uid, id, now);
  await member.set({ googleChecked: true }, { merge: true });
  return banned;
}
