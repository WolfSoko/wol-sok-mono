/**
 * The balance lab (ADR 0016): plays a matrix of matches against the
 * computer, reports win rates, medals and the difficulty curve, and holds
 * the tables the calibration moves. Only the lab's scripts in
 * `tools/bacteria-game/balance/` import it, as
 * `@wolsok/feat-shared-bacteria-engine/balance`; the game, the functions
 * and the admin never do. What they share with the game comes from the
 * main entry.
 */
export { playLabMatch } from './lib/state/balance/lab-match';
export type { LabMatch } from './lib/state/balance/lab-match';
export {
  checkDrift,
  checkMatrix,
  curveTable,
  drift,
  expectedStats,
  findings,
  FULL_RUN,
  fullMatrix,
  gainsOf,
  medalTable,
  summarize,
  versionDrift,
} from './lib/state/balance/report';
export type {
  BalanceReport,
  LabConfig,
  NamedCell,
} from './lib/state/balance/report';
export { SKILL, strengthOf } from './lib/state/difficulty-curve';
