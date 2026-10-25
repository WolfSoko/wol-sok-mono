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

/** A stored ban: until when it holds, null for good. */
interface BanDoc {
  until?: Timestamp | null;
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
    const until = (snapshot.data() as BanDoc | undefined)?.until;
    cached = {
      banned: snapshot.exists,
      until: until instanceof Timestamp ? until.toMillis() : null,
      at: readAt,
    };
    banCache.set(uid, cached);
  }
  return cached.banned && (cached.until === null || cached.until > now);
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

/**
 * Takes one of the player's submissions for this hour, and one of the
 * day's for everyone (ranked and unranked apart, ADR 0012), in one
 * transaction. False when either is used up: the submission is dropped.
 */
export async function takeSubmissionSlot(
  db: Firestore,
  uid: string,
  ranked: boolean,
  now: number = Date.now()
): Promise<boolean> {
  const hour = Math.floor(now / 3_600_000);
  const day = dayOf(now);
  const limitRef = db.doc(`limits/${uid}`);
  const counterRef = db.doc(`counters/${day}`);
  const field = ranked ? 'rankedSubmissions' : 'submissions';
  const cap = ranked ? DAILY_RANKED_SUBMISSIONS : DAILY_SUBMISSIONS;
  return db.runTransaction(async (tx) => {
    const [limit, counter] = await tx.getAll(limitRef, counterRef);
    const sameHour = limit.get('hour') === hour;
    const used = sameHour ? Number(limit.get('submissions') ?? 0) : 0;
    const usedToday = Number(counter.get(field) ?? 0);
    if (used >= SUBMISSIONS_PER_HOUR || usedToday >= cap) {
      return false;
    }
    tx.set(limitRef, { hour, submissions: used + 1 }, { merge: true });
    tx.set(
      counterRef,
      {
        [field]: FieldValue.increment(1),
        expireAt: Timestamp.fromMillis(now + 40 * 24 * 3_600_000),
      },
      { merge: true }
    );
    return true;
  });
}
