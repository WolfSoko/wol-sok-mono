import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import {
  BAN_CACHE_MS,
  DAILY_RANKED_SUBMISSIONS,
  DAILY_SUBMISSIONS,
  RETRY_FOR_MS,
  SUBMISSIONS_PER_HOUR,
} from './config';

/** Thrown for a player whose ban holds now. */
export class Banned extends Error {
  public constructor(public readonly uid: string) {
    super(`The player ${uid} is banned`);
    this.name = 'Banned';
  }
}

const banCache = new Map<
  string,
  { banned: boolean; until: number | null; at: number }
>();

/**
 * Throws {@link Banned} while `bans/{uid}` holds (ADR 0012). A ban ends by
 * itself at `until`, inclusive like the rules' `notBanned()`. The ban
 * document is kept a minute per instance.
 */
export async function assertActive(
  db: Firestore,
  uid: string,
  now: number = Date.now()
): Promise<void> {
  if (await isBanned(db, uid, now)) {
    throw new Banned(uid);
  }
}

/**
 * Whether `bans/{uid}` holds at `now` - see {@link assertActive}. The ban
 * document is read as it stands (or as cached up to a minute ago, by the
 * clock), and only its `until` is judged at `now`, which may lie in the
 * past for a retried event.
 */
export async function isBanned(
  db: Firestore,
  uid: string,
  now: number = Date.now()
): Promise<boolean> {
  const readAt = Date.now();
  let cached = banCache.get(uid);
  if (cached === undefined || readAt - cached.at > BAN_CACHE_MS) {
    const snapshot = await db.doc(`bans/${uid}`).get();
    cached = {
      banned: snapshot.exists,
      until: banUntil(snapshot.data()),
      at: readAt,
    };
    banCache.set(uid, cached);
  }
  return cached.banned && banHolds(cached.until, now);
}

/** A stored ban's end in ms, null for good (or no ban). */
export function banUntil(
  ban: Record<string, unknown> | undefined
): number | null {
  const until = ban?.['until'];
  return until instanceof Timestamp ? until.toMillis() : null;
}

/**
 * Whether a ban that ends at `until` (null: never) holds at `now` - the
 * end inclusive, like the rules' `notBanned()`.
 */
export function banHolds(until: number | null, now: number): boolean {
  return until === null || until > now;
}

/** Forgets the cached ban decisions - for specs. */
export function clearBanCache(): void {
  banCache.clear();
}

/**
 * True for a retried event, written at `at` (ms), too old to act on - see
 * {@link RETRY_FOR_MS}.
 */
export function tooOldToRetry(at: number, now: number): boolean {
  return now - at > RETRY_FOR_MS;
}

/** The UTC day of a moment, `YYYY-MM-DD`. */
export function dayOf(millis: number): string {
  return new Date(millis).toISOString().slice(0, 10);
}

/** Why a submission got no slot - see {@link takeSubmissionSlot}. */
export type SlotRefusal = 'limit' | 'cap';

/**
 * Takes one of the player's submissions for this hour, and one of the
 * day's for everyone, in one transaction - ranked and unranked apart, each
 * with its own count (ADR 0012). Null when it got one; else what was used
 * up: `limit`, the player's hour, or `cap`, the day's for everyone (which
 * still counts against the player's hour). Taking the slot deletes the
 * submission, so when `acceptReplay` retries it finds none and takes no
 * slot again; the retry works from its event's copy.
 */
export async function takeSubmissionSlot(
  db: Firestore,
  uid: string,
  ranked: boolean,
  submissionId: string,
  now: number = Date.now()
): Promise<SlotRefusal | null> {
  const hour = Math.floor(now / 3_600_000);
  const day = dayOf(now);
  const limitRef = db.doc(`limits/${uid}`);
  const counterRef = db.doc(`counters/${day}`);
  const submissionRef = db.doc(`replaySubmissions/${submissionId}`);
  const field = ranked ? 'rankedSubmissions' : 'submissions';
  const cap = ranked ? DAILY_RANKED_SUBMISSIONS : DAILY_SUBMISSIONS;
  return db.runTransaction(async (tx) => {
    const [limit, counter, submission] = await tx.getAll(
      limitRef,
      counterRef,
      submissionRef
    );
    if (!submission.exists) {
      return null;
    }
    const sameHour = limit.get('hour') === hour;
    const used = sameHour ? Number(limit.get(field) ?? 0) : 0;
    if (used >= SUBMISSIONS_PER_HOUR) {
      return 'limit';
    }
    tx.set(
      limitRef,
      sameHour
        ? { [field]: used + 1 }
        : { hour, submissions: 0, rankedSubmissions: 0, [field]: 1 },
      { merge: true }
    );
    if (Number(counter.get(field) ?? 0) >= cap) {
      return 'cap';
    }
    tx.set(
      counterRef,
      {
        [field]: FieldValue.increment(1),
        expireAt: Timestamp.fromMillis(now + 40 * 24 * 3_600_000),
      },
      { merge: true }
    );
    tx.delete(submissionRef);
    return null;
  });
}
