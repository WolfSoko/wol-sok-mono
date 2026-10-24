import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { dayOf, hourOf } from './time';

/** Submissions a player may make in an hour (ADR 0011). */
export const HOURLY_SUBMISSIONS = 60;
/**
 * Unranked submissions all players together may make in a UTC day: it
 * bounds storage and writes, since guest accounts are free (ADR 0011).
 */
export const DAILY_SUBMISSIONS = 20_000;
/**
 * Submissions of declared attempts in a UTC day - a cap of their own, so
 * unranked replays cannot use up the ranked ones (ADR 0012).
 */
export const DAILY_RANKED_SUBMISSIONS = 20_000;

/** How long an instance trusts a ban it read. */
const BAN_CACHE_MS = 60_000;

/** Thrown for a banned player whose own write a function was to act on. */
export class Banned extends Error {
  public constructor(public readonly uid: string) {
    super(`Player ${uid} is banned`);
    this.name = 'Banned';
  }
}

interface CachedBan {
  /** The ban's end in ms, null for permanent; undefined for no ban. */
  until: number | null | undefined;
  readAt: number;
}

const bans = new Map<string, CachedBan>();

/**
 * Throws {@link Banned} while `bans/{uid}` holds a ban that has not ended.
 * A ban ends by itself at `until`, wherever it is checked (ADR 0012). Read
 * at most once a minute per player and instance.
 *
 * Called only where a player's own write is acted on (`acceptReplay`, a
 * player's `remove`) - never for a deletion or a profile change, so a
 * banned player's data can still be erased and reset.
 */
export async function assertActive(
  db: Firestore,
  uid: string,
  now = Date.now()
): Promise<void> {
  let cached = bans.get(uid);
  if (cached === undefined || now - cached.readAt > BAN_CACHE_MS) {
    const ban = await db.doc(`bans/${uid}`).get();
    const until = ban.get('until') as Timestamp | null | undefined;
    cached = {
      until: !ban.exists ? undefined : until == null ? null : until.toMillis(),
      readAt: now,
    };
    bans.set(uid, cached);
  }
  if (isBanned(cached.until, now)) {
    throw new Banned(uid);
  }
}

/** True for a ban that has not ended - null is for good. */
export function isBanned(
  until: number | null | undefined,
  now: number
): boolean {
  return until !== undefined && (until === null || until > now);
}

/** Forgets the bans read - for tests. */
export function forgetBans(): void {
  bans.clear();
}

/**
 * Takes one of the player's submissions of this hour - false when the
 * hour's {@link HOURLY_SUBMISSIONS} are used up.
 */
export async function takeHourlySubmission(
  db: Firestore,
  uid: string,
  now = Date.now()
): Promise<boolean> {
  const hour = hourOf(now);
  const ref = db.doc(`limits/${uid}`);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const count = doc.get('hour') === hour ? (doc.get('count') as number) : 0;
    if (count >= HOURLY_SUBMISSIONS) {
      return false;
    }
    tx.set(ref, { hour, count: count + 1 }, { merge: true });
    return true;
  });
}

/**
 * Takes one of the day's submissions for everyone - ranked ones from their
 * own cap - false when the cap is reached.
 */
export async function takeDailySubmission(
  db: Firestore,
  ranked: boolean,
  now = Date.now()
): Promise<boolean> {
  const field = ranked ? 'rankedSubmissions' : 'submissions';
  const cap = ranked ? DAILY_RANKED_SUBMISSIONS : DAILY_SUBMISSIONS;
  const ref = db.doc(`counters/${dayOf(now)}`);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const count = (doc.get(field) as number | undefined) ?? 0;
    if (count >= cap) {
      return false;
    }
    tx.set(ref, { [field]: count + 1 }, { merge: true });
    return true;
  });
}
