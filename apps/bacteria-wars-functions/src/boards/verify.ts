import {
  getLevel,
  matchRecord,
  medalFor,
  type MedalTier,
  type Replay,
  type ReplayOutcome,
  type ReplayResult,
  replayVerdict,
  type SizeSample,
  TICKS_PER_SEC,
} from '@wolsok/feat-shared-bacteria-engine';

/** What playing a replay again found (ADR 0011, 0012). */
export type VerifiedState = 'verified' | 'unverified' | 'balance-mismatch';

/** What a verified replay keeps of its match: the end and its course. */
export interface ReplaySummary {
  ticks: number;
  endedBy: string;
  winnerSeat: number | null;
  /** The colony sizes by seat at the end. */
  sizes: number[];
  /**
   * The sizes once a second, at most {@link TIMELINE_POINTS} of them, seat
   * by seat in one list (`[s0, s1, s0, s1, ...]`): Firestore holds no
   * arrays in arrays.
   */
  timeline: number[];
}

export interface Verdict {
  state: VerifiedState;
  summary?: ReplaySummary;
  /**
   * A verified match against the computer: the medallion the human's run
   * earned in the re-run, null for none - never what the client claimed.
   * The level statistics count it (ADR 0016 §4).
   */
  medal?: MedalTier | null;
  /** How long the re-run took, for the budget. */
  ms: number;
}

/** The points a summary's timeline keeps - six minutes at one a second. */
export const TIMELINE_POINTS = 360;

/**
 * Judges a stored replay with the engine's {@link replayVerdict} and keeps
 * what the boards need of it: the state, a summary of a verified match,
 * its medallion against the computer and how long the re-run took.
 *
 * A replay the engine cannot play for another reason than its balance
 * table is stored as `unverified`, like one that played to another end.
 */
export function verifyReplay(
  replay: Replay,
  clock: () => number = () => performance.now()
): Verdict {
  const start = clock();
  const verdict = replayVerdict(replay);
  const ms = clock() - start;
  switch (verdict.state) {
    case 'balance-mismatch':
      return { state: 'balance-mismatch', ms };
    case 'unplayable':
    case 'unverified':
      return { state: 'unverified', ms };
    case 'verified':
      return {
        state: 'verified',
        summary: summaryOf(verdict.result, verdict.outcome),
        ...(replay.header.mode === 'vs-computer'
          ? { medal: medalOf(replay, verdict.result) }
          : {}),
        ms,
      };
  }
}

/** A verified match's end and its course, thinned to the timeline's points. */
function summaryOf(
  result: ReplayResult,
  { endedBy, winnerSeat }: ReplayOutcome
): ReplaySummary {
  const step = Math.max(1, Math.ceil(result.samples.length / TIMELINE_POINTS));
  return {
    ticks: result.ticks,
    endedBy,
    winnerSeat,
    sizes: result.players.map((player) => player.bacteriaCount),
    timeline: result.samples
      .filter((_, i) => i % step === 0)
      .flatMap((sizes) => [...sizes]),
  };
}

/** The medallion of a re-run match, judged as the result screen judges it. */
function medalOf({ header }: Replay, result: ReplayResult): MedalTier | null {
  const record = matchRecord(result.players, {
    levelId: header.levelId,
    difficulty: header.difficulty,
    durationSec: Math.floor(result.ticks / TICKS_PER_SEC),
    winner: result.outcome?.winner ?? null,
    // Only the peak share reads it, which no medallion asks for.
    capacity: 0,
  });
  return record === null
    ? null
    : medalFor(getLevel(header.levelId).medal, record);
}

/**
 * The per-second sizes a summary's timeline keeps, seat by seat - every
 * second of a match up to {@link TIMELINE_POINTS} seconds long.
 */
export function samplesOf(summary: ReplaySummary): SizeSample[] {
  const seats = Math.max(1, summary.sizes.length);
  const samples: SizeSample[] = [];
  for (let i = 0; i + seats <= summary.timeline.length; i += seats) {
    samples.push(summary.timeline.slice(i, i + seats));
  }
  return samples;
}
