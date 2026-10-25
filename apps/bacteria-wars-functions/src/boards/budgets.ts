/**
 * The verification budgets (ADR 0012) - server-only, unlike the board
 * contracts in the engine. The match-minutes ADR 0012 sets, at 20 s of CPU
 * per match-minute until the benchmark on a Cloud Run vCPU fixes them.
 */

/** An hour and a day, in ms. */
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

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
