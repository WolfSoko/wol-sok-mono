/**
 * The game's engine without Angular: what a server needs to play a match or
 * a replay again and check its result (ADR 0011). Imported as
 * `@wolsok/feat-lazy-bac-game/engine` from outside the lib, e.g. by Cloud
 * Functions in Node.
 *
 * Everything exported here, and everything it imports, stays free of
 * Angular, NgRx, RxJS, Firebase and the DOM: an oxlint override guards the
 * imports and `engine-bundle.spec.ts` bundles this file to prove it.
 */

// The match: setup, engine and simulation.
export {
  cpuSimulation,
  DRAG_STEPS,
  MatchEngine,
  noFrameEvents,
  onGrid,
  STEER_STEPS,
} from './lib/state/match-engine';
export type {
  FrameEvents,
  MatchOptions,
  MatchResult,
  PlayerSpawn,
} from './lib/state/match-engine';
export { planMatch } from './lib/state/match-setup';
export type { MatchPlan, OnlineSeats } from './lib/state/match-setup';
export { BacteriaSimulation } from './lib/state/bacteria-simulation';
export type {
  ColonySummary,
  Simulation,
  SimulationFactory,
} from './lib/state/simulation';
export {
  clock,
  countDown,
  TICK_MS,
  TICK_SEC,
  TICKS_PER_SEC,
  ticksToMs,
} from './lib/state/fixed-tick';

// Replays.
export {
  parseReplay,
  playReplay,
  REPLAY_VERSION,
  replayOf,
} from './lib/state/replay';
export type {
  Replay,
  ReplayBoost,
  ReplayDrag,
  ReplayHeader,
  ReplayInputs,
  ReplayResult,
  ReplaySteer,
  ReplayWeapon,
} from './lib/state/replay';
export { replayFromHash, replayLink } from './lib/state/replay-link';
export { GhostController } from './lib/state/ghost';
export type { SeatDriver } from './lib/state/ghost';

// Evolution: what a seat takes into a match against the computer (ADR 0013).
export {
  evolvedTraits,
  GENES,
  isPlainLoadout,
  parseLoadout,
  PLAIN_LOADOUT,
  weaponOf,
  WEAPON_EFFECTS,
  WEAPONS,
} from './lib/state/evolution';
export type {
  ActiveEffect,
  EvolvedTraits,
  GeneId,
  Loadout,
  WeaponFire,
  WeaponId,
} from './lib/state/evolution';

// Balance, levels and modes.
export {
  BALANCE_VERSION,
  gameBalance,
  NEUTRAL_TRAITS,
  PLAIN_TRAITS,
} from './lib/state/game-balance';
export type { ColonyTraits, GameBalance } from './lib/state/game-balance';
export {
  getLevel,
  isLadderLevel,
  isLadderLevelId,
  isLevelId,
  levelBalance,
  levelMap,
  levelSize,
  LEVELS,
  playableOnline,
} from './lib/state/levels';
export type { LadderLevelId, Level } from './lib/state/levels';
export { DEFAULT_MODE, isGameMode } from './lib/state/game-mode';
export type { GameMode } from './lib/state/game-mode';
export {
  BOT_DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  difficultyOption,
} from './lib/state/bot-controller';
export type { BotDifficulty } from './lib/state/bot-controller';
export { isHeadStart, isSeriesLength, startScales } from './lib/state/rivalry';
export type { HeadStart, SeriesLength } from './lib/state/rivalry';
export {
  COLONY_COLORS,
  DEFAULT_COLORS,
  isColonyColorId,
  validColorPair,
} from './lib/state/colony-colors';
export type { ColonyColorId } from './lib/state/colony-colors';
export { dailyLevelId, utcDay } from './lib/state/daily';
export { endlessLevelId } from './lib/state/endless';

// Results.
export { judgeOutcome, winRuleOf } from './lib/state/win-conditions';
export type {
  EndReason,
  MatchOutcome,
  WinRule,
} from './lib/state/win-conditions';
export type { Player } from './lib/state/player.model';
