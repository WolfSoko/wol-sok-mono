import {
  afterMatch,
  ENDLESS_LIVES,
  endlessLevelId,
  endlessSort,
  isRunOver,
  newRun,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import type { EntryBase } from './entries';
import type { ArrivalReason } from './declared-match';

/**
 * An endless run as the functions keep it (ADR 0012), pure: computed again
 * from all of the run's declared attempts and the replays that came for
 * them, in any order, every time one changes.
 */

/** A declared match of a run: its index and the server's time of it. */
export interface RunAttempt {
  i: number;
  at: number;
}

/** Why a ranked endless replay did (not) count - its `rankedReason`. */
export type EndlessReason = ArrivalReason;

/** What a replay of one declared match brought, checked on arrival. */
export interface AcceptedMatch {
  replayId: string;
  levelId: string;
  won: boolean;
  ticks: number;
  /** The arrival checks: `counted`, or why the match is refused. */
  reason: EndlessReason;
  /** The hour it came. */
  atHour: number;
  /** The balance table it was played on: another one is never re-run. */
  balanceVersion: number;
}

/** What became of a declared match. */
export type MatchResult = 'won' | 'lost' | 'refused' | 'no-replay' | 'pending';

export interface RunMatch {
  i: number;
  result: MatchResult;
  replayId?: string;
  ticks?: number;
  /** The hour its replay came. */
  atHour?: number;
  balanceVersion?: number;
}

/** A run computed from its attempts - see {@link computeRun}. */
export interface RunState {
  matches: RunMatch[];
  wins: number;
  lives: number;
  /** True once the last life is lost. */
  over: boolean;
  /**
   * When the first match without a replay was declared, while it may still
   * come: nothing after it counts yet. Null once the run is settled.
   */
  pendingAt: number | null;
}

/** A declared match without a replay this long after its `at` is lost. */
export const LOST_AFTER_MS = 2 * 3_600_000;

/**
 * Plays a run through its declared matches in order, from three lives
 * (ADR 0012). A match counts when its replay passed the arrival checks and
 * played the level the run was at, `endlessLevelId({ seed, wins })`, with
 * the wins before it; a refused replay or none 2 hours after the
 * declaration costs a life. A match still within those 2 hours stops the
 * count: what comes after depends on it.
 */
export function computeRun(
  runSeed: number,
  attempts: readonly RunAttempt[],
  accepted: Readonly<Record<string, AcceptedMatch>>,
  now: number
): RunState {
  const state: RunState = {
    matches: [],
    wins: 0,
    lives: ENDLESS_LIVES,
    over: false,
    pendingAt: null,
  };
  // The client's own run rules (`state/endless.ts`), so a run scores here
  // as it played there.
  let run = newRun(runSeed);
  for (const { i, at } of [...attempts].sort((a, b) => a.i - b.i)) {
    if (isRunOver(run)) {
      break;
    }
    const match = accepted[String(i)];
    if (match === undefined) {
      if (now - at < LOST_AFTER_MS) {
        state.matches.push({ i, result: 'pending' });
        state.pendingAt = at;
        break;
      }
      state.matches.push({ i, result: 'no-replay' });
      run = afterMatch(run, false);
      continue;
    }
    const counts =
      match.reason === 'counted' && match.levelId === endlessLevelId(run);
    const result: MatchResult = !counts
      ? 'refused'
      : match.won
        ? 'won'
        : 'lost';
    state.matches.push({
      i,
      result,
      replayId: match.replayId,
      ticks: match.ticks,
      atHour: match.atHour,
      balanceVersion: match.balanceVersion,
    });
    run = afterMatch(run, result === 'won');
  }
  return { ...state, wins: run.wins, lives: run.lives, over: isRunOver(run) };
}

/** The won matches of a run, in order - what verification plays again. */
export function winsOf(state: Pick<RunState, 'matches'>): RunMatch[] {
  return state.matches.filter((match) => match.result === 'won');
}

/**
 * A run's place on the `endless` board - null with no win yet. `cut` is
 * where verification stopped it (its verified prefix, "partly confirmed");
 * a run whose every win was played again is verified.
 */
export function endlessEntryBase(
  state: Pick<RunState, 'matches' | 'wins'>,
  verifiedWins: number,
  cut: number | null
): EntryBase | null {
  const depth = cut ?? state.wins;
  if (depth <= 0) {
    return null;
  }
  // The wins that count: all of them, or the verified prefix of a cut run.
  const kept = winsOf(state).slice(0, depth);
  const seconds = Math.floor(
    kept.reduce((sum, match) => sum + (match.ticks ?? 0), 0) / TICKS_PER_SEC
  );
  return {
    sort: endlessSort(depth, seconds),
    atHour: kept.at(-1)?.atHour ?? 0,
    baseStatus:
      cut !== null || verifiedWins >= depth ? 'verified' : 'provisional',
    show: { depth, seconds, ...(cut === null ? {} : { partial: true }) },
  };
}
