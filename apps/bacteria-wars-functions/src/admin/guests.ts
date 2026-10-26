import { logger } from 'firebase-functions/logger';
import { GUEST_IDLE_DAYS } from '../config';

/**
 * Guest accounts unused for {@link GUEST_IDLE_DAYS} days are deleted
 * (ADR 0012, owner's decision of 2026-10-26) by the daily `guestCleanup`.
 * The selection is pure, so the specs check it without Auth.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The longest a guest may go unused before its account goes. */
export const GUEST_IDLE_MS = GUEST_IDLE_DAYS * DAY_MS;

/** Accounts one `deleteUsers` call takes at most. */
export const DELETE_BATCH = 1000;

/** Guests one run deletes at most; the next day takes the rest. */
export const GUEST_SWEEP_LIMIT = 2000;

/** Guests erased at once. */
const PARALLEL_ERASES = 10;

/**
 * `deleteUsers` is rate limited to one call a second: the pause before
 * the next one, with room to spare.
 */
const DELETE_PAUSE_MS = 1500;

/** The parts of an Auth user the selection reads. */
export interface GuestRecord {
  uid: string;
  providerData: readonly unknown[];
  customClaims?: Record<string, unknown>;
  metadata: {
    creationTime: string;
    lastSignInTime: string;
    lastRefreshTime?: string | null;
  };
}

/**
 * When the account was last used, in ms: its last token refresh (a guest
 * signs in once and then only refreshes), else its last sign-in, else its
 * creation - null when Auth says none of them.
 */
export function lastActiveAt(user: GuestRecord): number | null {
  const { lastRefreshTime, lastSignInTime, creationTime } = user.metadata;
  for (const time of [lastRefreshTime, lastSignInTime, creationTime]) {
    const at = typeof time === 'string' ? Date.parse(time) : NaN;
    if (Number.isFinite(at)) {
      return at;
    }
  }
  return null;
}

/**
 * True for a guest - an account without any sign-in provider (anonymous,
 * or one that unlinked its last) and no admin claim - unused for longer
 * than {@link GUEST_IDLE_MS}. An account whose last use is unknown stays.
 */
export function isIdleGuest(user: GuestRecord, now: number): boolean {
  const at = lastActiveAt(user);
  return (
    user.providerData.length === 0 &&
    user.customClaims?.['admin'] !== true &&
    at !== null &&
    now - at > GUEST_IDLE_MS
  );
}

/** What `sweepGuests` needs of Auth and of the account clean-up. */
export interface GuestSweepPorts {
  listUsers(
    pageToken?: string
  ): Promise<{ users: readonly GuestRecord[]; pageToken?: string }>;
  deleteUsers(
    uids: readonly string[]
  ): Promise<{ successCount: number; failureCount: number }>;
  /** Erases the account's data, as its deletion does (`erasePlayer`). */
  erase(uid: string): Promise<void>;
  /** Waits between two `deleteUsers` calls. */
  pause(ms: number): Promise<void>;
}

/** What a sweep did - for the log and the specs. */
export interface GuestSweep {
  /** Accounts looked at. */
  listed: number;
  /** Idle guests found, up to the run's limit. */
  idle: number;
  /** Whose data could not be erased: their accounts stay for the next run. */
  failed: number;
  /** Accounts Auth deleted. */
  deleted: number;
}

/**
 * The daily clean-up of idle guests: pages through every account, picks
 * the idle guests ({@link isIdleGuest}, {@link GUEST_SWEEP_LIMIT} at most),
 * erases each one's data first (`erase`, a few at a time) and then deletes
 * the accounts whose data went, {@link DELETE_BATCH} a call and a call at
 * most every {@link DELETE_PAUSE_MS}. Erasing first, because Auth's bulk
 * deletion fires no `onDelete` trigger; the clean-up is idempotent, so
 * one that fires all the same changes nothing. An account whose erasing
 * failed stays, and the next run tries it again.
 */
export async function sweepGuests(
  ports: GuestSweepPorts,
  now: number
): Promise<GuestSweep> {
  const idle: string[] = [];
  let listed = 0;
  let pageToken: string | undefined;
  do {
    const page = await ports.listUsers(pageToken);
    listed += page.users.length;
    for (const user of page.users) {
      if (idle.length < GUEST_SWEEP_LIMIT && isIdleGuest(user, now)) {
        idle.push(user.uid);
      }
    }
    pageToken = page.pageToken;
  } while (pageToken !== undefined && idle.length < GUEST_SWEEP_LIMIT);
  const sweep: GuestSweep = {
    listed,
    idle: idle.length,
    failed: 0,
    deleted: 0,
  };
  for (let i = 0; i < idle.length; i += DELETE_BATCH) {
    const erased: string[] = [];
    const batch = idle.slice(i, i + DELETE_BATCH);
    for (let j = 0; j < batch.length; j += PARALLEL_ERASES) {
      const uids = batch.slice(j, j + PARALLEL_ERASES);
      const settled = await Promise.allSettled(
        uids.map((uid) => ports.erase(uid))
      );
      settled.forEach((result, k) => {
        if (result.status === 'fulfilled') {
          erased.push(uids[k]);
        } else {
          sweep.failed++;
          logger.error('Could not erase an idle guest', {
            uid: uids[k],
            error: result.reason,
          });
        }
      });
    }
    if (erased.length === 0) {
      continue;
    }
    if (i > 0) {
      await ports.pause(DELETE_PAUSE_MS);
    }
    const result = await ports.deleteUsers(erased);
    sweep.deleted += result.successCount;
    if (result.failureCount > 0) {
      logger.warn('Some idle guests were not deleted', {
        failed: result.failureCount,
      });
    }
  }
  return sweep;
}
