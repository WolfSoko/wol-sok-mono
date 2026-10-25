import {
  BOARD_CUT,
  dailyBoardId,
  NEXT_CANDIDATES,
  type Replay,
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
  DAY_MS,
  expectedRerunMs,
  FAILED_CHECKS_TO_SKIP,
  MAX_VERIFIED_TICKS,
  SLICE_MS,
} from './budgets';
import { storedReplay } from './declared-match';
import { type DailyAttemptRun, writeDailyEntry } from './rank-daily';
import { type Verdict, verifyReplay } from './verify';

/** What the verification needs to know of an account. */
export interface AccountInfo {
  /** When the account was made, in ms - null when unknown. */
  createdAt: number | null;
  /** True when it signs in with Google. */
  google: boolean;
}

/** A board verification looks at. */
export interface BoardRef {
  boardId: string;
}

/** A provisional entry waiting to be checked, and whose it is. */
export interface Candidate<B extends BoardRef = BoardRef> {
  board: B;
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
 * may be Safari. A re-run starts only when its expected cost fits in what
 * the slice has left, and each one is charged to the day as it ends, so a
 * slice cut short by the function's timeout has paid for what it did.
 */
export async function verifyDailySlice(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>,
  clock: () => number = () => performance.now(),
  verify: (replay: Replay) => Verdict = (replay) => verifyReplay(replay, clock)
): Promise<{ checked: number; spentMs: number }> {
  const budget = await sliceBudget(
    db,
    now,
    ['verifyMs'],
    DAILY_VERIFY_MS,
    SLICE_MS
  );
  if (budget <= 0) {
    return { checked: 0, spentMs: 0 };
  }
  const start = clock();
  let checked = 0;
  const boards = openDays(now).map((day) => ({
    boardId: dailyBoardId(day),
    day,
  }));
  for (const candidate of await candidates(
    db,
    now,
    accountInfo,
    'daily',
    boards
  )) {
    const began = clock();
    const left = budget - (began - start);
    if (left <= 0) {
      break;
    }
    if (await checkCandidate(db, candidate, now, verify, left)) {
      checked++;
    }
    await recordSpent(db, now, 'verifyMs', Math.round(clock() - began));
  }
  return { checked, spentMs: Math.round(clock() - start) };
}

/**
 * What a slice may still spend: at most `sliceMs`, and what the day's
 * `dayBudgetMs` leaves after the time the counter `fields` hold.
 */
export async function sliceBudget(
  db: Firestore,
  now: number,
  fields: readonly string[],
  dayBudgetMs: number,
  sliceMs: number
): Promise<number> {
  const counter = (await db.doc(`counters/${dayOf(now)}`).get()).data() ?? {};
  const spent = fields.reduce(
    (sum, field) => sum + Number(counter[field] ?? 0),
    0
  );
  return Math.min(sliceMs, dayBudgetMs - spent);
}

/** Adds a slice's time to the day's counter `field`. */
export async function recordSpent(
  db: Firestore,
  now: number,
  field: string,
  spentMs: number
): Promise<void> {
  await db.doc(`counters/${dayOf(now)}`).set(
    {
      [field]: FieldValue.increment(spentMs),
      expireAt: Timestamp.fromMillis(now + 40 * DAY_MS),
    },
    { merge: true }
  );
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
export async function candidates<B extends BoardRef>(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>,
  kind: 'daily' | 'endless',
  boards: readonly B[]
): Promise<Candidate<B>[]> {
  const lookup = async (board: B, entry: QueryDocumentSnapshot) => {
    const member = await db
      .collection('boardMembers')
      .where(`entryIds.${kind}`, '==', entry.id)
      .limit(1)
      .get();
    const uid = member.docs[0]?.id;
    if (uid === undefined) {
      return null;
    }
    const [moderation, info] = await Promise.all([
      db.doc(`moderation/${uid}`).get(),
      accountInfo(uid),
    ]);
    const skipUntil = moderation.get('skipUntil');
    if (skipUntil instanceof Timestamp && skipUntil.toMillis() > now) {
      return null;
    }
    return {
      board,
      entryId: entry.id,
      sort: Number(entry.get('sort')),
      uid,
      trust: trustOf(info, moderation.get('verifiedBefore') === true, now),
    };
  };
  const looked = await Promise.all(
    boards.map(async (board) => {
      const entries = await provisionalCandidates(
        db,
        board.boardId,
        BOARD_CUT[kind]
      );
      return Promise.all(entries.map((entry) => lookup(board, entry)));
    })
  );
  const seen = new Set<string>();
  const found: Candidate<B>[] = [];
  for (const candidate of looked.flat()) {
    if (candidate !== null && !seen.has(candidate.uid)) {
      seen.add(candidate.uid);
      found.push(candidate);
    }
  }
  return found.sort((a, b) => a.trust - b.trust || b.sort - a.sort);
}

/**
 * Plays a candidate's best provisional attempt again - false when none,
 * when its re-run would take longer than the `leftMs` of the slice, or
 * when another slice checked it meanwhile.
 */
async function checkCandidate(
  db: Firestore,
  candidate: Candidate<{ boardId: string; day: string }>,
  now: number,
  verify: (replay: Replay) => Verdict,
  leftMs: number
): Promise<boolean> {
  const runRef = db.doc(`dailyRuns/${candidate.board.day}_${candidate.uid}`);
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
  if (replay !== null && expectedRerunMs(replay) > leftMs) {
    return false;
  }
  const verdict: Verdict =
    replay === null ? { state: 'unverified', ms: 0 } : verify(replay);
  return db.runTransaction(async (tx) => {
    const fresh =
      ((await tx.get(runRef)).get('attempts') as
        | DailyAttemptRun[]
        | undefined) ?? [];
    // Another run may have checked it meanwhile (Cloud Scheduler delivers
    // at least once): a check applies once, or it counts a failure twice.
    if (
      fresh.find((a) => a.attemptId === best.attemptId)?.state !== 'provisional'
    ) {
      return false;
    }
    const next = fresh.map((a) =>
      a.attemptId === best.attemptId ? { ...a, state: verdict.state } : a
    );
    const moderationRef = db.doc(`moderation/${candidate.uid}`);
    const moderation = (await tx.get(moderationRef)).data() ?? {};
    await writeDailyEntry(
      tx,
      db,
      candidate.board.day,
      candidate.uid,
      next,
      now
    );
    tx.update(runRef, { attempts: next });
    tx.update(db.doc(`replays/${best.replayId}`), verdictFields(verdict));
    recordCheck(tx, moderationRef, moderation, verdict.state, now);
    return true;
  });
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

/** What a check writes on the replay it played. */
export function verdictFields(verdict: Verdict) {
  return {
    state: verdict.state,
    ...(verdict.summary === undefined ? {} : { summary: verdict.summary }),
    verifiedAt: FieldValue.serverTimestamp(),
  };
}
