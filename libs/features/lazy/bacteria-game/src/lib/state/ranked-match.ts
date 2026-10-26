import type { ReplayAttempt } from './replay';

/**
 * A ranked match about to be played (ADR 0012): the attempt it was declared
 * as, with the server's time of the declaration, and the seed that follows
 * from it (`attemptSeed`). The match plays `rankedPlan(levelId, seed)` on
 * the `gpu-int` ruleset and its replay carries the attempt.
 */
export interface RankedMatch {
  attempt: ReplayAttempt;
  seed: number;
}

/** A ranked endless run under way: its id and the next match to declare. */
export interface RankedRun {
  runId: string;
  /** The index of the run's next match, `e_<runId>_<next>`. */
  next: number;
}

/** Why a daily or endless match the player wanted ranked plays unranked. */
export type UnrankedReason =
  /** The declaration failed or timed out: offline, or the server too slow. */
  | 'offline'
  /** The three ranked daily attempts of the UTC day are used. */
  | 'used'
  /** The five ranked endless runs of the UTC day are started. */
  | 'runs-used'
  /** A later match of a ranked run could not be declared: the rest is unranked. */
  | 'run-dropped';

/**
 * What the result screen says about a daily or endless match and the
 * leaderboards - ids only, the texts are the components' (`boards.ranked`).
 */
export type RankedNote =
  | { kind: 'daily'; n: number }
  | { kind: 'endless'; match: number }
  | { kind: 'unranked'; reason: UnrankedReason };

/** What a ranked start came to: the match to play, and what to say of it. */
export interface RankedOutcome {
  /** The declared match - null when it plays unranked. */
  match: RankedMatch | null;
  note: RankedNote | null;
}
