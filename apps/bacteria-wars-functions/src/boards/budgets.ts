import {
  getLevel,
  levelSize,
  type Replay,
} from '@wolsok/feat-lazy-bac-game/engine';

/**
 * The verification budgets (ADR 0012) - server-only, unlike the board
 * contracts in the engine. The match-minutes ADR 0012 sets, at 20 s of CPU
 * per match-minute until the benchmark on a Cloud Run vCPU fixes them.
 */

/** A day, in ms. */
export const DAY_MS = 24 * 3_600_000;

/** CPU time a UTC day may spend re-running daily attempts. */
export const DAILY_VERIFY_MS = 1_200_000;

/**
 * CPU time a UTC day may spend re-running endless wins, on top of what the
 * daily boards leave of theirs.
 */
export const ENDLESS_VERIFY_MS = 3_600_000;

/** How long one hourly slice may verify before it stops. */
export const SLICE_MS = 25 * 60_000;

/** A daily or endless match longer than this is never re-run (10 min). */
export const MAX_VERIFIED_TICKS = 10 * 60 * 60;

/** Failed checks in a week that skip an account for a week. */
export const FAILED_CHECKS_TO_SKIP = 2;

/**
 * What a re-run is expected to cost, in ms of CPU a tick: the `gpu-int`
 * ruleset every ranked attempt plays (ADR 0015) took 6.8 to 9.8 ms a tick
 * on `IntSimulation` on the online grid in the re-run benchmark (ADR 0012),
 * and 28.9 to 39 ms on a big map. A slice starts a re-run only when this
 * fits in what it has left, so it never runs far past its end.
 */
export const RERUN_MS_PER_TICK = 10;
export const BIG_MAP_RERUN_MS_PER_TICK = 40;

/** The CPU time a re-run of `replay` is expected to take. */
export function expectedRerunMs({ header }: Replay): number {
  const perTick =
    levelSize(getLevel(header.levelId)) > 1
      ? BIG_MAP_RERUN_MS_PER_TICK
      : RERUN_MS_PER_TICK;
  return header.ticks * perTick;
}
