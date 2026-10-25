import {
  attemptSeed,
  BALANCE_VERSION,
  dailyLevelId,
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
