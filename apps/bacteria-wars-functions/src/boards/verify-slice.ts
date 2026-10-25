import {
  BOARD_CUT,
  dailyBoardId,
  NEXT_CANDIDATES,
  type Replay,
  replayFromBytes,
  utcDay,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentReference,
  FieldValue,
  type Firestore,
  type QueryDocumentSnapshot,
  Timestamp,
  type Transaction,
} from 'firebase-admin/firestore';
import { dayOf } from '../limits';
import {
  DAILY_VERIFY_MS,
  FAILED_CHECKS_TO_SKIP,
  MAX_VERIFIED_TICKS,
  SLICE_MS,
} from './budgets';
import { type DailyAttemptRun, writeDailyEntry } from './rank-daily';
import { type Verdict, verifyReplay } from './verify';

const DAY_MS = 24 * 3_600_000;

/** What the verification needs to know of an account. */
export interface AccountInfo {
  /** When the account was made, in ms - null when unknown. */
  createdAt: number | null;
  /** True when it signs in with Google. */
  google: boolean;
}

/** A provisional entry waiting to be checked, and whose it is. */
export interface Candidate {
  /** The board's UTC day - daily boards only. */
  day: string;
  entryId: string;
  sort: number;
  uid: string;
  trust: number;
}

/**
 * The trust a candidate is checked in (ADR 0012), lower first: accounts
 * linked to Google and at least 7 days old, or with an earlier verified
 * entry; then accounts at least 3 days old; then the rest. Fresh accounts
 * cost the budget only once the trusted ones are done.
 */
export function trustOf(
  info: AccountInfo,
  verifiedBefore: boolean,
  now: number
): number {
  const age = info.createdAt === null ? 0 : now - info.createdAt;
  if (verifiedBefore || (info.google && age >= 7 * DAY_MS)) {
    return 0;
  }
  return age >= 3 * DAY_MS ? 1 : 2;
}

/**
 * The boards still checked: today's, and yesterday's until 23:00 UTC, when
 * it closes.
 */
export function openDays(now: number): string[] {
  const today = utcDay(new Date(now));
  const hour = new Date(now).getUTCHours();
  return hour < 23 ? [today, utcDay(new Date(now - DAY_MS))] : [today];
}

/**
 * Spends a slice of the day's verification budget on the daily boards
 * (ADR 0012): provisional entries that could enter the verified top 10,
 * and the next 10, one per account, in trust order then by score. Each
 * plays the player's best provisional attempt again: verified keeps its
 * place; a failed check marks the attempt and the entry falls back to the
 * next best one. Two failed checks in 7 days skip an account for 7 days
 * and flag it for the owner (`moderation/{uid}`) - not a ban, a failure
 * may be Safari.
 */
export async function verifyDailySlice(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>,
  clock: () => number = () => performance.now(),
  verify: (replay: Replay) => Verdict = (replay) => verifyReplay(replay, clock)
): Promise<{ checked: number; spentMs: number }> {
  const counterRef = db.doc(`counters/${dayOf(now)}`);
  const spentToday = Number((await counterRef.get()).get('verifyMs') ?? 0);
  const budget = Math.min(SLICE_MS, DAILY_VERIFY_MS - spentToday);
  if (budget <= 0) {
    return { checked: 0, spentMs: 0 };
  }
  const start = clock();
  let checked = 0;
  const boards = openDays(now).map((day) => ({
    boardId: dailyBoardId(day),
    kind: 'daily' as const,
    day,
  }));
  for (const candidate of await candidates(db, now, accountInfo, boards)) {
    if (clock() - start >= budget) {
      break;
    }
    if (await checkCandidate(db, candidate, now, verify)) {
      checked++;
    }
  }
  const spentMs = Math.round(clock() - start);
  await counterRef.set(
    {
      verifyMs: FieldValue.increment(spentMs),
      expireAt: Timestamp.fromMillis(now + 40 * DAY_MS),
    },
    { merge: true }
  );
  return { checked, spentMs };
}

/** At most this many provisional entries are looked at per board. */
const CANDIDATE_SCAN = 100;

/**
 * A board's provisional entries worth a check: those whose `sort` would
 * put them into the verified top (above its last verified entry, or any
 * while fewer are verified), and the next {@link NEXT_CANDIDATES}.
 */
async function provisionalCandidates(
  db: Firestore,
  boardId: string,
  cut: number
): Promise<QueryDocumentSnapshot[]> {
  const entries = db.collection(`boards/${boardId}/entries`);
  const ordered = (status: string, limit: number) =>
    entries
      .where('status', '==', status)
      .orderBy('sort', 'desc')
      .orderBy('atHour', 'asc')
      .limit(limit)
      .get();
  const [verified, provisional] = await Promise.all([
    ordered('verified', cut),
    ordered('provisional', CANDIDATE_SCAN),
  ]);
  const lastVerified = verified.docs.at(-1);
  const threshold =
    verified.size < cut || lastVerified === undefined
      ? -Infinity
      : Number(lastVerified.get('sort'));
  const above = provisional.docs.filter(
    (doc) => Number(doc.get('sort')) > threshold
  ).length;
  return provisional.docs.slice(0, above + NEXT_CANDIDATES);
}

/**
 * The candidates of some boards of one kind, at most one per account, in
 * trust order then by score; accounts skipped after failed checks left out.
 */
export async function candidates(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>,
  boards: readonly {
    boardId: string;
    kind: 'daily' | 'endless';
    day?: string;
  }[]
): Promise<Candidate[]> {
  const found: Candidate[] = [];
  const seen = new Set<string>();
  for (const { boardId, kind, day = '' } of boards) {
    for (const entry of await provisionalCandidates(
      db,
      boardId,
      BOARD_CUT[kind]
    )) {
      const member = await db
        .collection('boardMembers')
        .where(`entryIds.${kind}`, '==', entry.id)
        .limit(1)
        .get();
      const uid = member.docs[0]?.id;
      if (uid === undefined || seen.has(uid)) {
        continue;
      }
      const moderation = (await db.doc(`moderation/${uid}`).get()).data() ?? {};
      const skipUntil = moderation['skipUntil'];
      if (skipUntil instanceof Timestamp && skipUntil.toMillis() > now) {
        continue;
      }
      seen.add(uid);
      found.push({
        day,
        entryId: entry.id,
        sort: Number(entry.get('sort')),
        uid,
        trust: trustOf(
          await accountInfo(uid),
          moderation['verifiedBefore'] === true,
          now
        ),
      });
    }
  }
  return found.sort((a, b) => a.trust - b.trust || b.sort - a.sort);
}

/** Plays a candidate's best provisional attempt again - false when none. */
async function checkCandidate(
  db: Firestore,
  candidate: Candidate,
  now: number,
  verify: (replay: Replay) => Verdict
): Promise<boolean> {
  const runRef = db.doc(`dailyRuns/${candidate.day}_${candidate.uid}`);
  const attempts =
    ((await runRef.get()).get('attempts') as DailyAttemptRun[] | undefined) ??
    [];
  const best = attempts
    .filter((a) => a.state === 'provisional' && a.ticks <= MAX_VERIFIED_TICKS)
    .sort((a, b) => b.sort - a.sort)[0];
  if (best === undefined) {
    return false;
  }
  const replay = await storedReplay(db, best.replayId);
  const verdict: Verdict =
    replay === null ? { state: 'unverified', ms: 0 } : verify(replay);
  await db.runTransaction(async (tx) => {
    const fresh =
      ((await tx.get(runRef)).get('attempts') as
        | DailyAttemptRun[]
        | undefined) ?? [];
    const next = fresh.map((a) =>
      a.attemptId === best.attemptId ? { ...a, state: verdict.state } : a
    );
    const moderationRef = db.doc(`moderation/${candidate.uid}`);
    const moderation = (await tx.get(moderationRef)).data() ?? {};
    await writeDailyEntry(tx, db, candidate.day, candidate.uid, next, now);
    tx.update(runRef, { attempts: next });
    tx.update(db.doc(`replays/${best.replayId}`), verdictFields(verdict));
    recordCheck(tx, moderationRef, moderation, verdict.state, now);
  });
  return true;
}

/**
 * Notes a check on the account (`moderation/{uid}`): a verified replay
 * moves it up the trust order; two failed ones in 7 days skip it for 7
 * days and flag it for the owner - not a ban, a failure may be Safari.
 * A balance mismatch says nothing about the player.
 */
export function recordCheck(
  tx: Transaction,
  moderationRef: DocumentReference,
  moderation: Record<string, unknown>,
  state: Verdict['state'],
  now: number
): void {
  if (state === 'verified') {
    tx.set(moderationRef, { verifiedBefore: true }, { merge: true });
  } else if (state === 'unverified') {
    const failures = (
      (moderation['failedAt'] as number[] | undefined) ?? []
    ).filter((at) => at > now - 7 * DAY_MS);
    failures.push(now);
    tx.set(
      moderationRef,
      {
        failedChecks: FieldValue.increment(1),
        failedAt: failures,
        ...(failures.length >= FAILED_CHECKS_TO_SKIP
          ? { skipUntil: Timestamp.fromMillis(now + 7 * DAY_MS) }
          : {}),
      },
      { merge: true }
    );
  }
}

/** A stored replay read back for a check - null when it is gone or damaged. */
export async function storedReplay(
  db: Firestore,
  replayId: string
): Promise<Replay | null> {
  const bytes = (await db.doc(`replays/${replayId}/blob/data`).get()).get(
    'bytes'
  );
  return bytes instanceof Uint8Array
    ? replayFromBytes(new Uint8Array(bytes), { stored: true })
    : null;
}

/** What a check writes on the replay it played. */
export function verdictFields(verdict: Verdict) {
  return {
    state: verdict.state,
    ...(verdict.summary === undefined ? {} : { summary: verdict.summary }),
    verifiedAt: FieldValue.serverTimestamp(),
  };
}
