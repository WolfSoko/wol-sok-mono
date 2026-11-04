import { TICKS_PER_SEC } from './fixed-tick';
import type { SizeSample } from './match-engine';
import type { ReplayOutcome } from './replay';

/**
 * Why a match is worth watching - a gallery badge each, shown through the
 * i18n keys `replay.reason.*` (ADR 0011).
 */
export type ReplayReason =
  | 'close'
  | 'comeback'
  | 'lead-changes'
  | 'length'
  | 'feat'
  | 'online';

/** What a replay's score is worked out from. */
export interface ReplayScoreInput {
  /** The colony sizes by seat after every full second of the match. */
  samples: readonly SizeSample[];
  /** How the match ended. */
  outcome: ReplayOutcome;
  /** How many ticks it lasted. */
  ticks: number;
  /** True for an online match between two humans both devices agreed on. */
  online?: boolean;
  /**
   * True for a feat: a platinum run on a hard or boss level, or the best
   * verified daily replay of the day - known to the caller, not the match.
   */
  feat?: boolean;
}

/** How good a match is to watch, from 0 to 100, and why. */
export interface ReplayScore {
  score: number;
  reasons: ReplayReason[];
}

/** What each reason adds to the score; the sum is capped at 100. */
const WEIGHTS: Readonly<Record<ReplayReason, number>> = {
  close: 25,
  comeback: 30,
  'lead-changes': 20,
  length: 15,
  feat: 25,
  online: 15,
};

/** The loser's share of the winner's colony that makes a finish close. */
const CLOSE_SHARE = 0.4;
/** How near a timed result has to be to count as close. */
const CLOSE_TIMED = 0.1;
/** Seconds after which a winner far behind makes a comeback. */
const COMEBACK_AFTER_SEC = 20;
/** How many times the lead has to change. */
const LEAD_CHANGES = 3;
/** The length a match worth watching has, in seconds. */
const MIN_LENGTH_SEC = 60;
const MAX_LENGTH_SEC = 6 * 60;

/**
 * The score of a match from its per-second samples: the client's hint that
 * ranks candidates, and the server's score once it played the match again.
 * Pure, so both come to the same.
 */
export function replayScore(input: ReplayScoreInput): ReplayScore {
  const reasons = (Object.keys(WEIGHTS) as ReplayReason[]).filter((reason) =>
    holds(reason, input)
  );
  const score = Math.min(
    100,
    reasons.reduce((sum, reason) => sum + WEIGHTS[reason], 0)
  );
  return { score, reasons };
}

function holds(reason: ReplayReason, input: ReplayScoreInput): boolean {
  switch (reason) {
    case 'close':
      return isClose(input);
    case 'comeback':
      return isComeback(input);
    case 'lead-changes':
      return leadChanges(input.samples) >= LEAD_CHANGES;
    case 'length': {
      const seconds = input.ticks / TICKS_PER_SEC;
      return seconds >= MIN_LENGTH_SEC && seconds <= MAX_LENGTH_SEC;
    }
    case 'feat':
      return input.feat === true;
    case 'online':
      return input.online === true;
  }
}

/**
 * The loser held at least 40 % of the winner's colony at the end, or a
 * timed result was within 10 %.
 */
function isClose({ samples, outcome }: ReplayScoreInput): boolean {
  const last = samples.at(-1);
  if (last === undefined || last.length < 2) {
    return false;
  }
  const winner = outcome.winnerSeat ?? (last[0] >= last[1] ? 0 : 1);
  const won = last[winner];
  const lost = last[1 - winner];
  if (won <= 0) {
    return false;
  }
  return (
    lost / won >= CLOSE_SHARE ||
    (outcome.endedBy === 'time' && (won - lost) / won <= CLOSE_TIMED)
  );
}

/**
 * The winner was at or below half the opponent's size at some point after
 * the first 20 seconds.
 */
function isComeback({ samples, outcome }: ReplayScoreInput): boolean {
  const winner = outcome.winnerSeat;
  if (winner === null) {
    return false;
  }
  return samples.some(
    (sizes, index) =>
      index + 1 > COMEBACK_AFTER_SEC &&
      sizes[1 - winner] > 0 &&
      sizes[winner] <= sizes[1 - winner] / 2
  );
}

/** How often the larger colony changed - a tie keeps the lead where it was. */
function leadChanges(samples: readonly SizeSample[]): number {
  let leader: number | null = null;
  let changes = 0;
  for (const [left, right] of samples) {
    const now: number | null = left > right ? 0 : right > left ? 1 : leader;
    if (leader !== null && now !== leader) {
      changes++;
    }
    leader = now;
  }
  return changes;
}
