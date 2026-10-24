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
  SecondSampler,
  SizeSample,
} from './lib/state/match-engine';
export { planMatch } from './lib/state/match-setup';
export type {
  MatchPlan,
  OnlineSeats,
  PlannedMatch,
} from './lib/state/match-setup';
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
  EVOLVED_REPLAY_VERSION,
  GHOST_REPLAY_VERSION,
  LADDER_REPLAY_VERSION,
  MAX_TICKS,
  parseReplay,
  playReplay,
  REPLAY_VERSION,
  replayOf,
  replayOutcome,
} from './lib/state/replay';
export type {
  ParseOptions,
  Replay,
  ReplayAttempt,
  ReplayBoost,
  ReplayDrag,
  ReplayExtras,
  ReplayHeader,
  ReplayInputs,
  ReplayOutcome,
  ReplayResult,
  ReplaySeat,
  ReplaySteer,
  ReplayWeapon,
} from './lib/state/replay';
export {
  MAX_PACKED_BYTES,
  MAX_UNPACKED_BYTES,
  packReplay,
  replayFromBytes,
  replayToBytes,
  unpackReplay,
} from './lib/state/replay-pack';
export type { PackedReplay, PackOptions } from './lib/state/replay-pack';
export { replayScore } from './lib/state/replay-score';
export type {
  ReplayReason,
  ReplayScore,
  ReplayScoreInput,
} from './lib/state/replay-score';
export { onlineReplayId } from './lib/state/replay-id';
export { matchChecksum } from './lib/state/checksum';
export { replayFromHash, replayLink } from './lib/state/replay-link';
export { GhostController } from './lib/state/ghost';
export type { SeatDriver } from './lib/state/ghost';

// The deterministic GPU simulation's integer building blocks (ADR 0015),
// shared by the shaders and the TypeScript reference.
export {
  chanceThreshold,
  mulQ14,
  ONE_Q14,
  Q14,
  Q14_STATE_MAX,
  TARGET_MAX,
  TARGET_SHIFT,
  toQ14,
  toTarget,
  toUnsignedQ14,
} from './lib/state/gpu-int/fixed-point';
export {
  drawAt,
  frameSeed,
  pcg3d,
  SALT,
  SALT_SPREAD,
  STEP_SALT_STRIDE,
  stepSalt,
} from './lib/state/gpu-int/draws';
export { isqrt, unitQ14 } from './lib/state/gpu-int/int-math';
export {
  INT_ENERGY_MAX,
  intMatchUniforms,
} from './lib/state/gpu-int/int-uniforms';
export type { IntMatchUniforms } from './lib/state/gpu-int/int-uniforms';
export {
  createIntFrameUniforms,
  fillIntCombatUniforms,
  fillIntFrameUniforms,
  INT_ATTACK_MAX,
  INT_COLONIES,
  INT_PELLETS,
} from './lib/state/gpu-int/int-frame-uniforms';
export type {
  FloatCombatUniforms,
  FloatFrameUniforms,
  IntFrameUniforms,
} from './lib/state/gpu-int/int-frame-uniforms';
export {
  createIntEffectUniforms,
  INT_EFFECT_RADIUS_MAX,
  INT_MAX_EFFECTS,
  setIntEffect,
} from './lib/state/gpu-int/int-effects';
export type {
  IntEffect,
  IntEffectUniforms,
} from './lib/state/gpu-int/int-effects';
// The TypeScript reference of the integer passes: what the shaders must
// match bit for bit, and what a server replays a deterministic match with.
export {
  INT_KIND,
  IntPassScratch,
  intStateHash,
} from './lib/state/gpu-int/int-reference';
export type {
  IntCombatUniforms,
  IntGrid,
  IntPassUniforms,
} from './lib/state/gpu-int/int-reference';
export {
  intColonyCounts,
  intReferenceTick,
} from './lib/state/gpu-int/int-tick';
export type { IntTickInputs } from './lib/state/gpu-int/int-tick';
export {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
} from './lib/state/gpu-int/int-readback';
// The whole deterministic simulation on the CPU - the fallback of a device
// whose GPU fails the self-test, and what a server plays a match with.
export { IntSimulation } from './lib/state/gpu-int/int-simulation';
export { WALL_BIT, ZONE_CODE, ZONE_SHIFT } from './lib/state/zones';
export { WEAPON_CODE } from './lib/state/weapon-effects';

// Evolution: what a seat takes into a match against the computer (ADR 0013).
export {
  evolvedTraits,
  GENES,
  isPlainLoadout,
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

// The ladder's computer: its skill along the curve and its evolution
// (ADR 0016), which `planMatch` plays for a plan with `ladder`.
export { computerLoadout } from './lib/state/computer-opponent';
export {
  computerProfile,
  LADDER_VERSION,
  targetWinRate,
} from './lib/state/difficulty-curve';

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
export type { BotDifficulty, BotProfile } from './lib/state/bot-controller';
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

// Leaderboards, declared attempts and admin commands (ADR 0012).
export {
  ANONYMOUS_NAME,
  atHourOf,
  BOARD_CUT,
  BOARD_KINDS,
  boardAvatar,
  boardTag,
  CHECKING_ROWS,
  compareRows,
  competitionRanks,
  dailyBoardId,
  dailySort,
  DEFAULT_NAME,
  endlessSort,
  formatTag,
  isBoardId,
  isEntryId,
  isUtcDay,
  NEXT_CANDIDATES,
  onlineSort,
  PAGE_ROWS,
  parseBoardId,
  posesAsLabel,
  TAG_COUNT,
  TOP_ROWS,
  VISIBLE_STATUSES,
  XP_FULL_COUNT,
  XP_FULL_COUNT_BEFORE,
  XP_RISE_BASE,
  XP_RISE_PER_DAY,
  XP_RISE_PER_HOUR,
  xpRiseCap,
  xpSort,
} from './lib/state/boards';
export type {
  BoardId,
  BoardKind,
  BoardRef,
  BoardRow,
  EntryShow,
  EntryStatus,
} from './lib/state/boards';
export {
  ARRIVAL_SLACK_MS,
  ATTEMPT_DAYS,
  attemptExpireAt,
  attemptSeed,
  canDeclare,
  COUNTDOWN_MS,
  dailyAttemptId,
  declaredBeforeMatch,
  endlessAttemptId,
  endlessRunId,
  isRankedPlan,
  nextDailyAttemptId,
  nextRunId,
  parseAttemptId,
  parseRunId,
  RANKED_DAILY_ATTEMPTS,
  RANKED_RUNS_PER_DAY,
  rankedPlan,
  requiredAttempt,
  RUN_MATCHES,
  submissionDeadline,
  UPLOAD_WINDOW_MS,
} from './lib/state/attempts';
export type {
  Attempt,
  DailyAttempt,
  EndlessAttempt,
} from './lib/state/attempts';
export {
  ADMIN_COMMAND_TYPES,
  BAN_REASONS,
  DESTRUCTIVE_COMMAND_TYPES,
  isAdminCommandType,
  isUid,
  parseAdminCommand,
  REASON_MAX,
} from './lib/state/admin-commands';
export type {
  AdminCommand,
  AdminCommandType,
  BanReason,
  EntryTarget,
  PlayerTarget,
} from './lib/state/admin-commands';
export { AVATAR_COUNT, defaultProfile } from './lib/social/profile';
export type { Avatar, Profile } from './lib/social/profile';

// Results.
export { judgeOutcome, winRuleOf } from './lib/state/win-conditions';
export type {
  EndReason,
  MatchOutcome,
  WinRule,
} from './lib/state/win-conditions';
export type { Player } from './lib/state/player.model';
