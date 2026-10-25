import {
  BALANCE_VERSION,
  playReplay,
  type Replay,
  replayOutcome,
} from '@wolsok/feat-lazy-bac-game/engine';

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
  /** How long the re-run took, for the budget. */
  ms: number;
}

/** The points a summary's timeline keeps - six minutes at one a second. */
export const TIMELINE_POINTS = 360;

/**
 * Plays a stored replay again on its ruleset's simulation - `cpu` on
 * `BacteriaSimulation`, `gpu-int` on `IntSimulation` - and compares the end
 * with what the device reported: ticks, outcome and checksum.
 *
 * A mismatch means "could not be confirmed", never "cheated": Safari and
 * Firefox may round some float functions differently from Node's V8 (on the
 * `cpu` ruleset; `gpu-int` is integer throughout). A replay of another
 * balance table cannot be played at all.
 */
export function verifyReplay(
  replay: Replay,
  clock: () => number = () => performance.now()
): Verdict {
  const start = clock();
  const { header } = replay;
  if (header.balanceVersion !== BALANCE_VERSION) {
    return { state: 'balance-mismatch', ms: clock() - start };
  }
  const result = playReplay(replay);
  const ms = clock() - start;
  if (result === null) {
    return { state: 'unverified', ms };
  }
  const outcome = replayOutcome(result.outcome);
  const claimed = header.outcome;
  const agrees =
    result.ticks === header.ticks &&
    result.checksum === header.checksum &&
    outcome !== null &&
    claimed !== undefined &&
    outcome.endedBy === claimed.endedBy &&
    outcome.winnerSeat === claimed.winnerSeat;
  if (!agrees || outcome === null) {
    return { state: 'unverified', ms };
  }
  const step = Math.max(1, Math.ceil(result.samples.length / TIMELINE_POINTS));
  return {
    state: 'verified',
    summary: {
      ticks: result.ticks,
      endedBy: outcome.endedBy,
      winnerSeat: outcome.winnerSeat,
      sizes: result.players.map((player) => player.bacteriaCount),
      timeline: result.samples
        .filter((_, i) => i % step === 0)
        .flatMap((sizes) => [...sizes]),
    },
    ms,
  };
}
