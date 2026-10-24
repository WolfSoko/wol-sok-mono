import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { AccountLookup } from '../accounts';
import type { Engine } from '../engine';
import {
  minuteTicks,
  Payer,
  VERIFY_MINUTES,
  VerifyPool,
} from '../replays/budgets';
import { ReplayDoc, verdictOf } from '../replays/model';
import { verifyStored } from '../replays/verify';
import { DAY_MS, dayOf, HOUR_MS } from '../time';
import type {
  DailyAttemptRow,
  EndlessRunDoc,
  EntryDoc,
  MemberDoc,
} from './model';
import {
  bestRow,
  rankedKind,
  updateDailyRun,
  updateEndlessRun,
} from './ranked';

/**
 * Lazy verification of the daily and endless boards (ADR 0012): the
 * provisional entries that would enter the verified top 10, then the next
 * 10, are re-run through `verify.ts` from the shared budget - trusted
 * accounts first, one candidate per account, board and day, and an account
 * that failed twice in 7 days skipped for 7 days.
 */

/** Days within which a second failed check skips an account. */
const FAIL_WINDOW_MS = 7 * DAY_MS;
/** How long such an account is skipped. */
const SKIP_MS = 7 * DAY_MS;
/** Account age of the first trust tier, with a Google link. */
const TRUSTED_AGE_MS = 7 * DAY_MS;
/** Account age of the second trust tier. */
const KNOWN_AGE_MS = 3 * DAY_MS;
/** Match minutes `board.verify` re-runs of a run at once. */
export const ADMIN_RUN_MINUTES = 6;

/**
 * Takes a re-run's result into the day or run of a ranked replay: verified
 * keeps its place, unverified or balance-mismatch marks the attempt and the
 * entry falls back to the player's next best. A failed check counts for
 * the owner (`moderation/{uid}`). Idempotent: an attempt already decided
 * is left as it is. Returns true when it changed the attempt.
 */
export async function applyRerun(
  db: Firestore,
  engine: Engine,
  replayId: string,
  doc: ReplayDoc,
  now = Date.now()
): Promise<boolean> {
  const verdict = verdictOf(doc.state);
  if (verdict === null) {
    return false;
  }
  const uid = doc.players[0];
  const kind = rankedKind(engine, doc);
  const parsed =
    doc.attempt === undefined ? null : engine.parseAttemptId(doc.attempt.id);
  if (uid === undefined || kind === null || parsed === null) {
    return false;
  }
  let changed = false;
  if (parsed.kind === 'daily') {
    await updateDailyRun(db, engine, uid, parsed.day, now, (rows) => {
      const row = rows.find((candidate) => candidate.replayId === replayId);
      if (
        row === undefined ||
        row.state === 'verified' ||
        row.state === 'failed'
      ) {
        return false;
      }
      row.state = verdict;
      changed = true;
      return true;
    });
  } else {
    await updateEndlessRun(
      db,
      engine,
      uid,
      parsed.runId,
      now,
      undefined,
      (run) => {
        const match = run.matches.find(
          (candidate) => candidate.replayId === replayId
        );
        if (
          match === undefined ||
          match.verified === true ||
          match.failed === true
        ) {
          return false;
        }
        if (verdict === 'verified') {
          match.verified = true;
        } else {
          match.failed = true;
        }
        changed = true;
        return true;
      }
    );
  }
  if (changed && doc.state === 'unverified') {
    await recordFailure(db, uid, now);
  }
  return changed;
}

/**
 * Counts a failed check for the owner: two in 7 days skip the account for
 * 7 days (`skipUntil`) - flagged, not banned, since Safari may round
 * differently.
 */
export async function recordFailure(
  db: Firestore,
  uid: string,
  now: number
): Promise<void> {
  const ref = db.doc(`moderation/${uid}`);
  await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const lastFailAt = (
      doc.get('lastFailAt') as Timestamp | undefined
    )?.toMillis();
    tx.set(
      ref,
      {
        failedChecks: FieldValue.increment(1),
        lastFailAt: Timestamp.fromMillis(now),
        ...(lastFailAt !== undefined && now - lastFailAt <= FAIL_WINDOW_MS
          ? { skipUntil: Timestamp.fromMillis(now + SKIP_MS) }
          : {}),
      },
      { merge: true }
    );
  });
  await db
    .doc(`counters/${dayOf(now)}`)
    .set({ failedChecks: FieldValue.increment(1) }, { merge: true });
}

/** A provisional entry worth re-running, with its player. */
export interface Candidate {
  boardId: string;
  entryId: string;
  uid: string;
  sort: number;
  /** 0 for the most trusted accounts, 2 for the rest. */
  tier: number;
  /** True inside the zone that would enter the verified top. */
  inZone: boolean;
}

/** An entry with its id. */
type Entry = EntryDoc & { entryId: string };

async function entriesOf(
  db: Firestore,
  boardId: string,
  status: 'verified' | 'provisional',
  limit: number
): Promise<Entry[]> {
  const snapshot = await db
    .collection(`boards/${boardId}/entries`)
    .where('status', '==', status)
    .orderBy('sort', 'desc')
    .orderBy('atHour', 'asc')
    .limit(limit)
    .get();
  return snapshot.docs.map((doc) => ({
    ...(doc.data() as EntryDoc),
    entryId: doc.id,
  }));
}

/**
 * The candidates of a board, in the order to re-run them: those that would
 * enter the verified top (above its last verified row, or any while fewer
 * than `cut` are verified), then the next 10 - each group trusted accounts
 * first, then by score. Skips accounts on a skip and accounts that had a
 * candidate on this board today.
 */
export async function candidatesOf(
  db: Firestore,
  engine: Engine,
  accounts: AccountLookup,
  boardId: string,
  now: number
): Promise<Candidate[]> {
  const board = engine.parseBoardId(boardId);
  if (board === null || (board.kind !== 'daily' && board.kind !== 'endless')) {
    return [];
  }
  const cut = engine.BOARD_CUT[board.kind];
  const verified = await entriesOf(db, boardId, 'verified', cut);
  // Read a few more than the zone could hold: skipped accounts drop out.
  const provisional = await entriesOf(
    db,
    boardId,
    'provisional',
    2 * (cut + engine.NEXT_CANDIDATES)
  );
  const threshold =
    verified.length < cut ? Number.NEGATIVE_INFINITY : verified[cut - 1].sort;
  const owners = await ownersOf(db, board.kind, provisional);
  const found = await accounts([...new Set(owners.values())].map((o) => o.uid));
  const moderation = await skipsOf(
    db,
    [...owners.values()].map((o) => o.uid)
  );
  const today = dayOf(now);
  const candidates: Candidate[] = [];
  let afterZone = 0;
  for (const entry of provisional) {
    const owner = owners.get(entry.entryId);
    if (owner === undefined) {
      continue;
    }
    const inZone = entry.sort > threshold;
    if (!inZone && afterZone >= engine.NEXT_CANDIDATES) {
      continue;
    }
    if (
      owner.member.checks?.[boardId] === today ||
      (moderation.get(owner.uid) ?? 0) > now
    ) {
      continue;
    }
    if (!inZone) {
      afterZone++;
    }
    const account = found.get(owner.uid);
    const age = account === undefined ? 0 : now - account.createdAt;
    const tier =
      owner.member.verifiedBefore === true ||
      (account !== undefined && !account.anonymous && age >= TRUSTED_AGE_MS)
        ? 0
        : age >= KNOWN_AGE_MS
          ? 1
          : 2;
    candidates.push({
      boardId,
      entryId: entry.entryId,
      uid: owner.uid,
      sort: entry.sort,
      tier,
      inZone,
    });
  }
  return candidates.sort(
    (a, b) =>
      Number(b.inZone) - Number(a.inZone) || a.tier - b.tier || b.sort - a.sort
  );
}

/** The players of entries, by entry id - one query per 30 ids. */
async function ownersOf(
  db: Firestore,
  kind: 'daily' | 'endless',
  entries: readonly Entry[]
): Promise<Map<string, { uid: string; member: MemberDoc }>> {
  const owners = new Map<string, { uid: string; member: MemberDoc }>();
  const ids = entries.map((entry) => entry.entryId);
  for (let i = 0; i < ids.length; i += 30) {
    const snapshot = await db
      .collection('boardMembers')
      .where(`entryIds.${kind}`, 'in', ids.slice(i, i + 30))
      .get();
    for (const doc of snapshot.docs) {
      const member = doc.data() as MemberDoc;
      owners.set(member.entryIds[kind], { uid: doc.id, member });
    }
  }
  return owners;
}

/** Each account's `skipUntil`, in ms. */
async function skipsOf(
  db: Firestore,
  uids: readonly string[]
): Promise<Map<string, number>> {
  const skips = new Map<string, number>();
  const unique = [...new Set(uids)];
  for (let i = 0; i < unique.length; i += 100) {
    const refs = unique
      .slice(i, i + 100)
      .map((uid) => db.doc(`moderation/${uid}`));
    for (const doc of await db.getAll(...refs)) {
      const until = doc.get('skipUntil') as Timestamp | undefined;
      if (until !== undefined) {
        skips.set(doc.id, until.toMillis());
      }
    }
  }
  return skips;
}

/**
 * What a slice of verification may spend, in match ticks: each pool's
 * share of what is left of its day, spread over the hours left, so early
 * hours do not use up the day. A pool may always start one re-run per
 * slice while its day has room, or a long match would never fit an hour.
 * Unused daily budget passes to endless.
 */
export class Slice {
  private readonly spent: Record<'daily' | 'endless', number> = {
    daily: 0,
    endless: 0,
  };

  public constructor(
    private readonly left: Record<'daily' | 'endless', number>,
    public readonly deadline: number
  ) {}

  /** The pool a re-run of `ticks` is paid from, null when none may pay it. */
  public poolFor(
    board: 'daily' | 'endless',
    ticks: number
  ): 'daily' | 'endless' | null {
    const fits = (pool: 'daily' | 'endless') =>
      this.spent[pool] === 0 || this.spent[pool] + ticks <= this.left[pool];
    if (fits(board)) {
      return board;
    }
    return board === 'endless' && fits('daily') ? 'daily' : null;
  }

  public spend(pool: 'daily' | 'endless', ticks: number): void {
    this.spent[pool] += ticks;
  }

  /** Pays a board's re-runs from this slice. */
  public payer(board: 'daily' | 'endless'): Payer {
    return {
      pool: (cost) => this.poolFor(board, cost),
      charge: (pool, cost) => this.spend(pool as 'daily' | 'endless', cost),
    };
  }

  public timeLeft(): boolean {
    return Date.now() < this.deadline;
  }
}

/** The slice of this hour, from the budgets used today. */
export async function hourSlice(
  db: Firestore,
  engine: Pick<Engine, 'TICKS_PER_SEC'>,
  now: number,
  deadline: number
): Promise<Slice> {
  const counters = await db.doc(`counters/${dayOf(now)}`).get();
  const hoursLeft = 24 - new Date(now).getUTCHours();
  const left = (pool: VerifyPool) => {
    const cap = minuteTicks(engine, VERIFY_MINUTES[pool]);
    const used =
      (counters.get(`verifyTicks.${pool}`) as number | undefined) ?? 0;
    return Math.max(0, Math.ceil((cap - used) / hoursLeft));
  };
  return new Slice(
    { daily: left('daily'), endless: left('endless') },
    deadline
  );
}

/** What verifying one candidate did. */
export type CandidateResult =
  | 'verified'
  | 'failed'
  | 'stale'
  | 'too-long'
  | 'no-budget'
  | 'nothing';

/**
 * Re-runs a daily candidate's best attempt. A claim from an older balance
 * cannot be re-run: it turns stale without counting as a failure.
 */
export async function verifyDaily(
  db: Firestore,
  engine: Engine,
  uid: string,
  day: string,
  pay: Payer,
  now: number
): Promise<CandidateResult> {
  const run = await db.doc(`dailyRuns/${day}_${uid}`).get();
  const best = bestRow(
    engine,
    (run.get('attempts') as DailyAttemptRow[] | undefined) ?? []
  );
  if (best === null || best.state !== 'provisional') {
    return 'nothing';
  }
  if (best.balanceVersion !== engine.BALANCE_VERSION) {
    await updateDailyRun(db, engine, uid, day, now, (rows) => {
      const row = rows.find((other) => other.replayId === best.replayId);
      if (row === undefined || row.state !== 'provisional') {
        return false;
      }
      row.state = 'stale';
      return true;
    });
    return 'stale';
  }
  const outcome = await rerunAndApply(db, engine, best.replayId, pay, now);
  return outcome === 'gone' ? 'nothing' : outcome;
}

/**
 * Re-runs a ranked replay, paid by `pay`, and takes the result into its
 * day or run. A match longer than `MAX_RERUN_TICKS` is 'too-long' - the
 * one place that limit is checked. 'gone' when the replay or its bytes
 * expired: it can never be re-run.
 */
async function rerunAndApply(
  db: Firestore,
  engine: Engine,
  replayId: string,
  pay: Payer,
  now: number
): Promise<CandidateResult | 'gone'> {
  const result = await verifyStored(
    db,
    engine,
    replayId,
    pay,
    engine.MAX_RERUN_TICKS,
    () => false,
    now
  );
  if (result === 'no-budget' || result === 'too-long') {
    return result;
  }
  if (result === 'no-replay' || result === 'no-blob') {
    return 'gone';
  }
  if (typeof result === 'string') {
    return 'nothing';
  }
  await applyRerun(db, engine, replayId, result.doc, now);
  return result.state === 'verified' ? 'verified' : 'failed';
}

/**
 * Re-runs the unverified wins of the player's best run in order, as far as
 * `maxTicks` and the budget allow. Stops at the first failure, which cuts
 * the run to its verified prefix. A win whose replay expired can never be
 * checked: the run turns stale once, and drops out of the candidates.
 */
export async function verifyRun(
  db: Firestore,
  engine: Engine,
  uid: string,
  pay: Payer,
  maxTicks: number,
  now: number,
  timeLeft: () => boolean = () => true
): Promise<CandidateResult> {
  const best = await db
    .collection('endlessRuns')
    .where('uid', '==', uid)
    .where('best', '==', true)
    .limit(1)
    .get();
  const run = best.docs[0]?.data() as EndlessRunDoc | undefined;
  if (run === undefined) {
    return 'nothing';
  }
  let spent = 0;
  let last: CandidateResult = 'nothing';
  let all = true;
  const wins = run.matches.filter(
    (match) =>
      match.state === 'won' && match.verified !== true && match.replayId
  );
  for (const match of wins) {
    if (match.balanceVersion !== engine.BALANCE_VERSION) {
      return 'stale';
    }
    const ticks = match.ticks ?? 0;
    if (spent > 0 && (spent + ticks > maxTicks || !timeLeft())) {
      all = false;
      break;
    }
    const outcome = await rerunAndApply(
      db,
      engine,
      match.replayId as string,
      pay,
      now
    );
    if (outcome === 'gone') {
      await updateEndlessRun(
        db,
        engine,
        uid,
        run.runId,
        now,
        undefined,
        (current) => {
          const gone = current.matches.find(
            (candidate) => candidate.replayId === match.replayId
          );
          if (gone !== undefined) {
            gone.gone = true;
          }
          delete current.queued;
          return true;
        }
      );
      return 'stale';
    }
    last = outcome;
    spent += ticks;
    if (last !== 'verified') {
      all = last === 'failed';
      break;
    }
  }
  if (all && run.queued === true) {
    await db
      .doc(`endlessRuns/${uid}_${run.runId}`)
      .update({ queued: FieldValue.delete() });
  }
  return last;
}

/** What a slice of verification did. */
export interface SliceResult {
  checked: number;
  verified: number;
  failed: number;
}

/**
 * The hourly verification slice: today's and yesterday's daily boards (a
 * day is checked until 23:00 UTC the next day), then the endless board,
 * runs the owner queued first - until the slice is spent or the time is
 * up.
 */
export async function verifyBoardsSlice(
  db: Firestore,
  engine: Engine,
  accounts: AccountLookup,
  slice: Slice,
  now = Date.now()
): Promise<SliceResult> {
  const result: SliceResult = { checked: 0, verified: 0, failed: 0 };
  const today = dayOf(now);
  const days = [dayOf(now - DAY_MS), today].filter(
    (day) => now < dailyFinalAt(engine, day)
  );
  const note = (outcome: CandidateResult) => {
    if (outcome === 'verified' || outcome === 'failed') {
      result.checked++;
      result[outcome]++;
    }
  };
  for (const day of days) {
    const boardId = engine.dailyBoardId(day);
    let exhausted = false;
    for (const candidate of await candidatesOf(
      db,
      engine,
      accounts,
      boardId,
      now
    )) {
      if (!slice.timeLeft() || exhausted) {
        break;
      }
      const outcome = await verifyDaily(
        db,
        engine,
        candidate.uid,
        day,
        slice.payer('daily'),
        now
      );
      exhausted = outcome === 'no-budget';
      if (!exhausted) {
        await markChecked(db, candidate.uid, boardId, today);
      }
      note(outcome);
    }
  }

  const queued = await db
    .collection('endlessRuns')
    .where('queued', '==', true)
    .limit(20)
    .get();
  const endless = [
    ...queued.docs.map((doc) => doc.get('uid') as string),
    ...(await candidatesOf(db, engine, accounts, 'endless', now)).map(
      (candidate) => candidate.uid
    ),
  ];
  for (const uid of new Set(endless)) {
    if (!slice.timeLeft()) {
      break;
    }
    const outcome = await verifyRun(
      db,
      engine,
      uid,
      slice.payer('endless'),
      Number.POSITIVE_INFINITY,
      now,
      () => slice.timeLeft()
    );
    if (outcome === 'no-budget') {
      break;
    }
    await markChecked(db, uid, 'endless', today);
    note(outcome);
  }
  logger.info('Verification slice done', result);
  return result;
}

async function markChecked(
  db: Firestore,
  uid: string,
  boardId: string,
  day: string
): Promise<void> {
  await db
    .doc(`boardMembers/${uid}`)
    .set({ checks: { [boardId]: day } }, { merge: true });
}

/** When a daily board turns final: 23:00 UTC the day after. */
export function dailyFinalAt(engine: Engine, day: string): number {
  return (
    Date.parse(`${day}T00:00:00Z`) + DAY_MS + engine.DAILY_FINAL_HOUR * HOUR_MS
  );
}
