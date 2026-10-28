/**
 * Why a stored replay did or did not count on its board - the
 * `rankedReason` the functions write on `replays/{id}` (ADR 0011, 0012).
 * The functions take their types from these lists (through `engine.ts`),
 * and the game's texts are looked up by them (`replay.reasons`), so a new
 * reason goes in here and gets its text.
 */

/** What every declared (ranked) match is checked for - `checkDeclaredMatch`. */
export const DECLARED_REASONS = [
  'counted',
  'ruleset',
  'seed',
  'plan-mismatch',
  'level',
  'early',
  'late',
] as const;
export type DeclaredReason = (typeof DECLARED_REASONS)[number];

/** Why a declared match did (not) count, as its replay carries it. */
export const ARRIVAL_REASONS = [
  ...DECLARED_REASONS,
  'banned',
  'no-attempt',
  'void',
  'duplicate',
  'unreadable',
] as const;
export type ArrivalReason = (typeof ARRIVAL_REASONS)[number];

/** What the hourly sweep writes on an online match only one device reported. */
export const NOT_REPORTED = 'not-reported';

/**
 * Why an online match did (not) count on the online board: what ranking
 * an agreed match decides, and {@link NOT_REPORTED}.
 */
export const ONLINE_REASONS = [
  'counted',
  'desync',
  'short',
  'stub-expired',
  'banned',
  'too-fast',
  'pair-cap',
  NOT_REPORTED,
] as const;
export type OnlineReason = (typeof ONLINE_REASONS)[number];
