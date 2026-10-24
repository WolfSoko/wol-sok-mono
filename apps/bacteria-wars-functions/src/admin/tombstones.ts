import { createHmac } from 'node:crypto';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import type { BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import { isBanned } from '../limits';
import { DAY_MS } from '../time';

/**
 * Ban tombstones (ADR 0012): a ban that survives deleting a Google
 * account. `banTombstones/{hmac}` is keyed by an HMAC-SHA256 of the
 * account's `google.com` provider uid with the server secret
 * `BAN_TOMBSTONE_KEY` (Secret Manager), so nobody outside can reverse or
 * guess the key. It expires with the ban, after 2 years at most.
 */

/** The longest a tombstone is kept. */
export const TOMBSTONE_MAX_MS = 2 * 365 * DAY_MS;

/** Keys a Google identity with the secret. */
export interface TombstoneKey {
  idOf(googleUid: string): string;
}

/**
 * The key from the secret's value - read from Secret Manager at run time
 * (`defineSecret`), never written into the code. Refuses a short secret.
 */
export function tombstoneKey(secret: string): TombstoneKey {
  if (secret.length < 16) {
    throw new Error('BAN_TOMBSTONE_KEY is missing or too short');
  }
  return {
    idOf: (googleUid) =>
      createHmac('sha256', secret).update(googleUid).digest('hex'),
  };
}

/** A tombstone as stored. */
export interface Tombstone {
  /** The ban's end in ms, null for permanent. */
  until: number | null;
  reason: BanReason;
}

/** Writes or replaces the tombstone of a banned Google identity. */
export async function writeTombstone(
  db: Firestore,
  key: TombstoneKey,
  googleUid: string,
  tombstone: Tombstone,
  now: number
): Promise<void> {
  const expireAt = Math.min(
    tombstone.until ?? Number.POSITIVE_INFINITY,
    now + TOMBSTONE_MAX_MS
  );
  await db.doc(`banTombstones/${key.idOf(googleUid)}`).set({
    until:
      tombstone.until === null ? null : Timestamp.fromMillis(tombstone.until),
    reason: tombstone.reason,
    expireAt: Timestamp.fromMillis(expireAt),
  });
}

export async function deleteTombstone(
  db: Firestore,
  key: TombstoneKey,
  googleUid: string
): Promise<void> {
  await db.doc(`banTombstones/${key.idOf(googleUid)}`).delete();
}

/** The tombstone of a Google identity whose ban has not ended, or null. */
export async function findTombstone(
  db: Firestore,
  key: TombstoneKey,
  googleUid: string,
  now: number
): Promise<Tombstone | null> {
  const doc = await db.doc(`banTombstones/${key.idOf(googleUid)}`).get();
  if (!doc.exists) {
    return null;
  }
  const until = doc.get('until') as Timestamp | null;
  const expireAt = doc.get('expireAt') as Timestamp | undefined;
  const end = until === null ? null : until.toMillis();
  if (
    !isBanned(end, now) ||
    (expireAt !== undefined && expireAt.toMillis() <= now)
  ) {
    return null;
  }
  return { until: end, reason: doc.get('reason') as BanReason };
}
