/**
 * The verification budgets (ADR 0012) - server-only, unlike the board
 * contracts in the engine. The match-minutes ADR 0012 sets, at 20 s of CPU
 * per match-minute until the benchmark on a Cloud Run vCPU fixes them.
 */

/** CPU time a UTC day may spend re-running daily attempts. */
export const DAILY_VERIFY_MS = 1_200_000;

/** How long one hourly slice may verify before it stops. */
export const SLICE_MS = 25 * 60_000;

/** A daily or endless match longer than this is never re-run (10 min). */
export const MAX_VERIFIED_TICKS = 10 * 60 * 60;

/** Failed checks in a week that skip an account for a week. */
export const FAILED_CHECKS_TO_SKIP = 2;
