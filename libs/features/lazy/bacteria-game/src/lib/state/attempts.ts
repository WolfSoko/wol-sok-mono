import { arenaSize, ONLINE_SIM_RESOLUTION } from './arena-size';
import { isUtcDay } from './boards';
import { DEFAULT_COLORS } from './colony-colors';
import { utcDay } from './daily';
import { isPlainLoadout } from './evolution';
import { TICKS_PER_SEC } from './fixed-tick';
import { getLevel, levelSize } from './levels';
import type { MatchPlan } from './match-setup';

/**
 * Declared attempts (ADR 0012): the ids a player declares before a ranked
 * daily or endless match, the seed that follows from the declaration, the
 * ranked setup every such match plays, and the timing a replay must keep.
 * Pure: the Firestore rules check the same ids, the functions the rest.
 */

/** Ranked attempts at the daily level a player has a day. */
export const RANKED_DAILY_ATTEMPTS = 3;
/** Ranked endless runs a player may start a day. */
export const RANKED_RUNS_PER_DAY = 5;
/** Declared matches an endless run may have, attempt 0 to 999. */
export const RUN_MATCHES = 1000;
/** Days an attempt is kept (its `expireAt`); the rules allow up to 32. */
export const ATTEMPT_DAYS = 31;

/** A daily attempt: `d_YYYY-MM-DD_n`. */
export interface DailyAttempt {
  kind: 'daily';
  day: string;
  /** 1 to 3. */
  n: number;
}

/** A match of an endless run: `e_<runId>_<i>`. */
export interface EndlessAttempt {
  kind: 'endless';
  /** `YYYYMMDD` + r. */
  runId: string;
  /** The UTC day the run started, `YYYY-MM-DD`. */
  day: string;
  /** The run of that day, 1 to 5. */
  r: number;
  /** The match of the run, 0 to 999. */
  i: number;
}

export type Attempt = DailyAttempt | EndlessAttempt;

/** The id of the `n`th ranked attempt on `day`'s daily level. */
export function dailyAttemptId(day: string, n: number): string {
  if (!isUtcDay(day) || !inRange(n, 1, RANKED_DAILY_ATTEMPTS)) {
    throw new RangeError(`No daily attempt ${n} on ${day}`);
  }
  return `d_${day}_${n}`;
}

/** The id of the `r`th ranked endless run started on `day`. */
export function endlessRunId(day: string, r: number): string {
  if (!isUtcDay(day) || !inRange(r, 1, RANKED_RUNS_PER_DAY)) {
    throw new RangeError(`No run ${r} on ${day}`);
  }
  return `${day.replaceAll('-', '')}${r}`;
}

/** The id of match `i` of an endless run. */
export function endlessAttemptId(runId: string, i: number): string {
  if (parseRunId(runId) === null || !inRange(i, 0, RUN_MATCHES - 1)) {
    throw new RangeError(`No match ${i} of run ${runId}`);
  }
  return `e_${runId}_${i}`;
}

const DAILY_ID = /^d_(\d{4}-\d{2}-\d{2})_([1-9])$/;
const RUN_ID = /^(\d{4})(\d{2})(\d{2})([1-9])$/;
const ENDLESS_ID = /^e_(\d{9})_(0|[1-9]\d{0,2})$/;

/** The day and number of a run id - null for anything else. */
export function parseRunId(runId: string): { day: string; r: number } | null {
  const match = RUN_ID.exec(runId);
  if (match === null) {
    return null;
  }
  const day = `${match[1]}-${match[2]}-${match[3]}`;
  const r = Number(match[4]);
  return isUtcDay(day) && r <= RANKED_RUNS_PER_DAY ? { day, r } : null;
}

/** An attempt id taken apart - null for anything the rules refuse. */
export function parseAttemptId(id: string): Attempt | null {
  const daily = DAILY_ID.exec(id);
  if (daily !== null) {
    const [, day, n] = daily;
    return isUtcDay(day) && Number(n) <= RANKED_DAILY_ATTEMPTS
      ? { kind: 'daily', day, n: Number(n) }
      : null;
  }
  const endless = ENDLESS_ID.exec(id);
  const run = endless === null ? null : parseRunId(endless[1]);
  return endless === null || run === null
    ? null
    : { kind: 'endless', runId: endless[1], ...run, i: Number(endless[2]) };
}

/**
 * The attempt that has to exist before this one can be declared - null
 * when none has to:
 * - daily attempt `n > 1` needs attempt `n − 1` of that day;
 * - endless match `i > 0` needs match `i − 1` of its run;
 * - endless match 0 of run `r > 1` needs match 0 of run `r − 1` that day.
 */
export function requiredAttempt(attempt: Attempt): string | null {
  if (attempt.kind === 'daily') {
    return attempt.n > 1 ? dailyAttemptId(attempt.day, attempt.n - 1) : null;
  }
  if (attempt.i > 0) {
    return endlessAttemptId(attempt.runId, attempt.i - 1);
  }
  return attempt.r > 1
    ? endlessAttemptId(endlessRunId(attempt.day, attempt.r - 1), 0)
    : null;
}

/**
 * True when attempt `id` is taken: declared already (`declared`), unless a
 * daily attempt the server marked void (`isVoid`), which may be declared
 * again in its place. A void endless match counts as not played, and its
 * run goes on with the next one.
 */
export function attemptTaken(
  id: string,
  declared: boolean,
  isVoid: boolean
): boolean {
  return declared && !(isVoid && parseAttemptId(id)?.kind === 'daily');
}

/**
 * True when `id` may be declared at `atMillis` (the server's time) by a
 * player holding the attempts `declared` - what the Firestore rules check.
 * A daily attempt and the first match of a run belong to the UTC day of
 * the declaration; a run's later matches may go on past midnight. A daily
 * attempt the server marked void (`voided`, its submission dropped on the
 * server's side, ADR 0012) may be declared again in its place.
 */
export function canDeclare(
  id: string,
  atMillis: number,
  declared: ReadonlySet<string>,
  voided: ReadonlySet<string> = new Set()
): boolean {
  const attempt = parseAttemptId(id);
  if (attempt === null || attemptTaken(id, declared.has(id), voided.has(id))) {
    return false;
  }
  const today = utcDay(new Date(atMillis));
  if ((attempt.kind === 'daily' || attempt.i === 0) && attempt.day !== today) {
    return false;
  }
  const required = requiredAttempt(attempt);
  return required === null || declared.has(required);
}

/**
 * The next ranked daily attempt on `day`, null once all three are used - a
 * `voided` one first, which is declared again in its place.
 */
export function nextDailyAttemptId(
  day: string,
  declared: ReadonlySet<string>,
  voided: ReadonlySet<string> = new Set()
): string | null {
  for (let n = 1; n <= RANKED_DAILY_ATTEMPTS; n++) {
    const id = dailyAttemptId(day, n);
    if (!attemptTaken(id, declared.has(id), voided.has(id))) {
      return id;
    }
  }
  return null;
}

/** The ranked daily attempts on `day` not yet taken - a void one counts. */
export function dailyAttemptsLeft(
  day: string,
  declared: ReadonlySet<string>,
  voided: ReadonlySet<string> = new Set()
): number {
  let left = 0;
  for (let n = 1; n <= RANKED_DAILY_ATTEMPTS; n++) {
    const id = dailyAttemptId(day, n);
    if (!attemptTaken(id, declared.has(id), voided.has(id))) {
      left++;
    }
  }
  return left;
}

/** The next ranked run to start on `day`, null once five have started. */
export function nextRunId(
  day: string,
  declared: ReadonlySet<string>
): string | null {
  for (let r = 1; r <= RANKED_RUNS_PER_DAY; r++) {
    const runId = endlessRunId(day, r);
    if (!declared.has(endlessAttemptId(runId, 0))) {
      return runId;
    }
  }
  return null;
}

/** The ranked runs still to start on `day`: five less those with a match 0. */
export function runsLeft(day: string, declared: ReadonlySet<string>): number {
  let started = 0;
  for (let r = 1; r <= RANKED_RUNS_PER_DAY; r++) {
    if (declared.has(endlessAttemptId(endlessRunId(day, r), 0))) {
      started++;
    }
  }
  return RANKED_RUNS_PER_DAY - started;
}

/**
 * The attempts that say what is left of `day`: its daily attempts and the
 * match 0 of each of its runs.
 */
export function dayAttemptIds(day: string): string[] {
  return [
    ...Array.from({ length: RANKED_DAILY_ATTEMPTS }, (_, i) =>
      dailyAttemptId(day, i + 1)
    ),
    ...Array.from({ length: RANKED_RUNS_PER_DAY }, (_, i) =>
      endlessAttemptId(endlessRunId(day, i + 1), 0)
    ),
  ];
}

/** When an attempt declared at `atMillis` expires (its TTL). */
export function attemptExpireAt(atMillis: number): number {
  return atMillis + ATTEMPT_DAYS * 86_400_000;
}

// --- Seed ------------------------------------------------------------------

/**
 * The seed of a declared attempt's match, from the player, the attempt and
 * the server's time of the declaration - so no match can be played before
 * it. An endless run's levels come from the seed of its match 0.
 * A 32-bit unsigned integer, the same in every JavaScript engine.
 *
 * The time counts in whole milliseconds, as the server's Admin SDK reads
 * it: a fraction (the browser SDK's `toMillis()` keeps microseconds) is
 * floored, so both sides hash the same text.
 */
export function attemptSeed(
  uid: string,
  attemptId: string,
  atMillis: number
): number {
  const text = `${uid}\u0000${attemptId}\u0000${Math.floor(atMillis)}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

// --- Ranked setup ----------------------------------------------------------

/**
 * The one setup a ranked attempt plays, whatever the player's setup says:
 * against normal bots, without a head start, the player in seat 0 (the
 * left colony, as in every `vs-computer` plan), on the level's online grid
 * and in the default colours.
 */
export function rankedPlan(levelId: string, seed: number): MatchPlan {
  return {
    levelId,
    mode: 'vs-computer',
    difficulty: 'normal',
    colors: [DEFAULT_COLORS[0], DEFAULT_COLORS[1]],
    headStart: 0,
    ...arenaSize(ONLINE_SIM_RESOLUTION, levelSize(getLevel(levelId))),
    seed,
  };
}

/**
 * True when a plan is exactly the ranked plan of its level and seed - no
 * evolved loadouts either, which change what a match does.
 */
export function isRankedPlan(plan: MatchPlan): boolean {
  const ranked = rankedPlan(plan.levelId, plan.seed);
  return (
    plan.mode === ranked.mode &&
    plan.difficulty === ranked.difficulty &&
    plan.colors.length === 2 &&
    plan.colors[0] === ranked.colors[0] &&
    plan.colors[1] === ranked.colors[1] &&
    plan.headStart === ranked.headStart &&
    plan.width === ranked.width &&
    plan.height === ranked.height &&
    (plan.loadouts === undefined || plan.loadouts.every(isPlainLoadout))
  );
}

// --- Timing ----------------------------------------------------------------

/** The countdown before a match. */
export const COUNTDOWN_MS = 5_000;
/** How long after its end a ranked replay may be uploaded. */
export const UPLOAD_WINDOW_MS = 300_000;
/** The slack between the declaration plus the match and the replay's arrival. */
export const ARRIVAL_SLACK_MS = 120_000;

function matchMs(ticks: number): number {
  return (ticks / TICKS_PER_SEC) * 1000;
}

/**
 * The latest `createdAt` of a ranked submission:
 * `at + 5 s countdown + ticks / 60 s + 300 s`. A later one never ranks
 * (`late`).
 */
export function submissionDeadline(atMillis: number, ticks: number): number {
  return atMillis + COUNTDOWN_MS + matchMs(ticks) + UPLOAD_WINDOW_MS;
}

/**
 * True when the declaration came before the match:
 * `at + match time ≤ arrival + 120 s`.
 */
export function declaredBeforeMatch(
  atMillis: number,
  ticks: number,
  arrivalMillis: number
): boolean {
  return atMillis + matchMs(ticks) <= arrivalMillis + ARRIVAL_SLACK_MS;
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
