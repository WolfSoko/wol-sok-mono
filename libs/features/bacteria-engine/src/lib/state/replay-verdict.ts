import {
  playbackRefusal,
  playReplay,
  type Replay,
  type ReplayOutcome,
  type ReplayResult,
  replayOutcome,
} from './replay';

/**
 * What playing a replay again found, against what its header claims
 * (ADR 0011, 0012):
 * - `verified`: it played to exactly the claimed ticks, checksum and outcome;
 * - `unverified`: it played, but to another end, or to none, or the header
 *   claims none - "could not be confirmed",
 *   never "cheated" (another browser may round floats differently on `cpu`);
 * - `balance-mismatch`: recorded on another balance table, not played;
 * - `unplayable`: a replay the engine cannot play out as it was played for
 *   any other reason (format, ruleset, ladder computer, float GPU - see
 *   `playbackRefusal`).
 */
export type ReplayVerdict =
  | { state: 'verified'; result: ReplayResult; outcome: ReplayOutcome }
  | { state: 'unverified'; result: ReplayResult }
  | { state: 'balance-mismatch' }
  | { state: 'unplayable' };

/**
 * Plays a recorded match again on its ruleset's simulation (see
 * `playReplay`) and judges it against its header's ticks, checksum and
 * outcome. A replay of another balance table is never played.
 */
export function replayVerdict(replay: Replay): ReplayVerdict {
  if (playbackRefusal(replay) === 'balance') {
    return { state: 'balance-mismatch' };
  }
  // Null for every other refusal of playbackRefusal.
  const result = playReplay(replay);
  if (result === null) {
    return { state: 'unplayable' };
  }
  const outcome = replayOutcome(result.outcome);
  return outcome !== null && agrees(replay, result, outcome)
    ? { state: 'verified', result, outcome }
    : { state: 'unverified', result };
}

/** True when a re-run ended where the replay's header says it did. */
function agrees(
  { header }: Replay,
  result: ReplayResult,
  outcome: ReplayOutcome
): boolean {
  const claimed = header.outcome;
  return (
    result.ticks === header.ticks &&
    result.checksum === header.checksum &&
    claimed !== undefined &&
    outcome.endedBy === claimed.endedBy &&
    outcome.winnerSeat === claimed.winnerSeat
  );
}
