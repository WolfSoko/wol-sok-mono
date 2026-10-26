import {
  attemptSeed,
  BALANCE_VERSION,
  dailyLevelId,
  ENDLESS_LIVES,
  endlessAttemptId,
  endlessLevelId,
  GPU_INT_REPLAY_VERSION,
  rankedPlan,
  type Replay,
  type ReplayHeader,
} from '@wolsok/feat-lazy-bac-game/engine';

/** The player of the specs' ranked daily replays - never bundled. */
export const UID = 'ada';
export const ATTEMPT = 'd_2026-10-25_1';
export const AT = Date.UTC(2026, 9, 25, 10);
/** One minute of play. */
export const TICKS = 3_600;

/** A ranked daily replay of {@link ATTEMPT}, as the device records it. */
export function dailyReplay(
  header: Partial<ReplayHeader> = {},
  uid = UID,
  attempt = ATTEMPT,
  at = AT
): Replay {
  const plan = rankedPlan(
    dailyLevelId(attempt.slice(2, 12)),
    attemptSeed(uid, attempt, at)
  );
  return {
    header: {
      ...plan,
      version: GPU_INT_REPLAY_VERSION,
      balanceVersion: BALANCE_VERSION,
      simulation: 'gpu-int',
      ticks: TICKS,
      seats: [{ isBot: false }, { isBot: true }],
      outcome: { endedBy: 'annihilation', winnerSeat: 0 },
      checksum: 1,
      attempt: { id: attempt, at },
      ...header,
    },
    inputs: { steers: [], drags: [], boosts: [], weapons: [] },
  };
}

/** The run of the specs' endless matches: run 1 of 2026-10-25. */
export const RUN_ID = '202610251';

/** The run's level seed: the seed of its match 0, declared at `at0`. */
export function runSeedOf(at0: number, uid = UID, runId = RUN_ID): number {
  return attemptSeed(uid, endlessAttemptId(runId, 0), at0);
}

/**
 * A ranked replay of match `i` of {@link RUN_ID}, declared at `at`, on the
 * level the run is at after `wins` wins.
 */
export function endlessReplay(
  i: number,
  at: number,
  at0: number,
  wins: number,
  header: Partial<ReplayHeader> = {},
  uid = UID,
  runId = RUN_ID
): Replay {
  const attempt = endlessAttemptId(runId, i);
  const levelId = endlessLevelId({
    seed: runSeedOf(at0, uid, runId),
    wins,
    lives: ENDLESS_LIVES,
  });
  return {
    header: {
      ...rankedPlan(levelId, attemptSeed(uid, attempt, at)),
      version: GPU_INT_REPLAY_VERSION,
      balanceVersion: BALANCE_VERSION,
      simulation: 'gpu-int',
      ticks: TICKS,
      seats: [{ isBot: false }, { isBot: true }],
      outcome: { endedBy: 'annihilation', winnerSeat: 0 },
      checksum: 1,
      attempt: { id: attempt, at },
      ...header,
    },
    inputs: { steers: [], drags: [], boosts: [], weapons: [] },
  };
}
