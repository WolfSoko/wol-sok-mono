/**
 * The verification budgets (ADR 0012) - server-only, unlike the board
 * contracts in the engine. The day budgets are CPU ms, from the
 * match-minutes ADR 0012 sets at 20 s of CPU per match-minute; what one
 * re-run is expected to take is `expectedRerunMs`, at the rate measured
 * since for `gpu-int`. The benchmark on a Cloud Run vCPU fixes both.
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
 * What a re-run is expected to cost, in ms of CPU a tick. Ranked attempts
 * play the `gpu-int` ruleset (ADR 0015) on generated levels, all of the
 * base arena's size, and `IntSimulation` took 6.8 to 9.8 ms a tick there
 * in the re-run benchmark of the closed #2618, on a development machine;
 * the Cloud Run benchmark ADR 0012 calls for still sets the final figure.
 * A slice starts a re-run only when its expected cost fits in what it has
 * left, so it never runs far past its end.
 */
const RERUN_MS_PER_TICK = 10;

/** The CPU time a re-run of a match of `ticks` is expected to take. */
export function expectedRerunMs(ticks: number): number {
  return ticks * RERUN_MS_PER_TICK;
}

/** The admin's "verify now" budget a day: 20 match-minutes (ADR 0012). */
export const ADMIN_VERIFY_MS = 400_000;

/**
 * What one `board.verify` spends at most: 6 match-minutes, well inside the
 * trigger's 540 s.
 */
export const ADMIN_COMMAND_MS = expectedRerunMs(6 * 60 * 60);
