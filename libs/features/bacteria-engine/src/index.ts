/**
 * The game's engine without Angular: the match, its simulation, replays,
 * levels, progress, the English texts it renders itself and the
 * translation mechanics (ADR 0011); the game's other texts live in the
 * game lib, the documents it shares with the server in the `/cloud` entry
 * (`cloud.ts`), the GPU mirror of the simulation in the `/gpu` entry
 * (`gpu.ts`). The game's UI, its Cloud Functions and its admin area
 * import it as `@wolsok/feat-shared-bacteria-engine`; nothing imports a
 * path inside it.
 *
 * Everything here stays free of Angular, NgRx, RxJS, Firebase and the DOM:
 * an oxlint override guards the imports, Jest runs the specs in Node, and
 * `engine-bundle.spec.ts` bundles this file to prove it.
 */
export { ENGINE_EN } from './lib/i18n/engine-texts';
export { english, renderGameText } from './lib/i18n/game-text';
export type { GameText } from './lib/i18n/game-text';
export {
  detectLanguage,
  isLanguage,
  LANGUAGES,
  LOCALES,
} from './lib/i18n/language';
export type { Language } from './lib/i18n/language';
export { lookUp, translate } from './lib/i18n/translation';
export type {
  Dictionary,
  EntryPath,
  Plural,
  Translation,
  TranslationParams,
} from './lib/i18n/translation';
export {
  ADMIN_PATH,
  GAME_SITE_URL,
  LEGAL_NOTICE_PATH,
  PRIVACY_POLICY_PATH,
  PRIVACY_POLICY_URL,
} from './lib/site/legal-links';
export {
  GALLERY_PATH,
  galleryPath,
  galleryUrl,
  inLang,
  WATCH_PARAM,
  WATCH_PATH,
} from './lib/site/watch-links';
export {
  AVATAR_COUNT,
  cleanMotto,
  cleanName,
  defaultProfile,
  IMAGE_MAX,
  isGooglePhoto,
  isImageData,
  MOTTO_MAX,
  NAME_MAX,
  parseProfile,
} from './lib/social/profile';
export type { Avatar, PlayerCard, Profile } from './lib/social/profile';
export { ACHIEVEMENT_IDS } from './lib/state/progress/achievement-ids';
export type { AchievementId } from './lib/state/progress/achievement-ids';
export {
  ACHIEVEMENTS,
  achievementTexts,
  earnAchievements,
} from './lib/state/progress/achievements';
export {
  arenaSize,
  BASE_ARENA,
  DEFAULT_SCREEN_RESOLUTION,
  DEFAULT_SIM_RESOLUTION,
  detailScale,
  escapeReach,
  ONLINE_SIM_RESOLUTION,
  renderScale,
  SCREEN_RESOLUTIONS,
  SIM_RESOLUTIONS,
  simResolutionOf,
  simScale,
} from './lib/state/simulation/arena-size';
export type {
  ScreenResolution,
  SimResolution,
} from './lib/state/simulation/arena-size';
export { BacteriaSimulation } from './lib/state/simulation/bacteria-simulation';
export type {
  ColonySpawn,
  Nutrient,
} from './lib/state/simulation/bacteria-simulation';
export { fromBase64, toBase64 } from './lib/state/base64';
export {
  BOT_DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  difficultyOption,
} from './lib/state/match/bot-controller';
export type {
  BotDifficulty,
  BotProfile,
} from './lib/state/match/bot-controller';
export {
  continueText,
  furthestOpenLevel,
  ladderLocks,
  ladderLockText,
  newlyUnlocked,
} from './lib/state/levels/campaign';
export type { CampaignSummary } from './lib/state/levels/campaign';
export { Cells } from './lib/state/simulation/cells';
export type { CellList } from './lib/state/simulation/cells';
export { CHAPTERS } from './lib/state/levels/chapters';
export type { ChapterId } from './lib/state/levels/chapters';
export { matchChecksum } from './lib/state/match/checksum';
export {
  COLONY_COLORS,
  colonyColorText,
  DEFAULT_COLORS,
  getColonyColor,
  isColonyColorId,
  NEUTRAL_COLOR,
  onlineColors,
  pickColor,
  readableOn,
  sameColors,
  seatFirst,
  toPlayerColor,
  validColorPair,
} from './lib/state/progress/colony-colors';
export type { ColonyColorId } from './lib/state/progress/colony-colors';
export {
  computerLook,
  NEUTRAL_LOOK,
  seatLooks,
} from './lib/state/progress/colony-looks';
export { computerLoadout } from './lib/state/match/computer-opponent';
export {
  attemptsOn,
  DAILY_ATTEMPTS,
  dailyLevelId,
  isDailyLevelId,
  standingStreak,
  utcDay,
} from './lib/state/levels/daily';
export {
  computerProfile,
  LADDER_VERSION,
  targetWinRate,
} from './lib/state/match/difficulty-curve';
export type { MatchEarnings } from './lib/state/progress/earnings';
export {
  afterMatch,
  ENDLESS_LIVES,
  endlessLevelId,
  isRunOver,
  newRun,
} from './lib/state/levels/endless';
export type { EndlessRun } from './lib/state/levels/endless';
export {
  adoptEvolution,
  availableDna,
  canBuyAnySkin,
  canBuyAnything,
  canBuyGene,
  canBuySkin,
  canBuyWeapon,
  EMPTY_EVOLUTION,
  levelOf,
  loadoutOf,
  mergeEvolution,
  nextGeneCost,
  ownsSkin,
  parseEvolution,
  refundableDna,
  resetEvolution,
  sameEvolution,
  withEquipped,
  withGeneLevel,
  withSkin,
  withWeapon,
} from './lib/state/progress/evolution-progress';
export type { EvolutionProgress } from './lib/state/progress/evolution-progress';
export {
  dnaEarned,
  evolvedTraits,
  geneLevel,
  GENES,
  isPlainLoadout,
  MAX_GENE_LEVEL,
  PLAIN_LOADOUT,
  WEAPON_EFFECTS,
  weaponOf,
  WEAPONS,
} from './lib/state/simulation/evolution';
export type {
  ActiveEffect,
  EvolvedTraits,
  Gene,
  GeneId,
  Loadout,
  WeaponFire,
  WeaponId,
} from './lib/state/simulation/evolution';
export {
  clock,
  countDown,
  TICK_MS,
  TICK_SEC,
  TickClock,
  TICKS_PER_SEC,
  ticksToMs,
} from './lib/state/simulation/fixed-tick';
export type { GameFrame } from './lib/state/simulation/fixed-tick';
export { FramePacer } from './lib/state/match/frame-pacer';
export {
  BALANCE_VERSION,
  colonyCapacity,
  gameBalance,
  NEUTRAL_TRAITS,
  PLAIN_TRAITS,
} from './lib/state/simulation/game-balance';
export type {
  ColonyTraits,
  GameBalance,
} from './lib/state/simulation/game-balance';
export { getMap } from './lib/state/levels/game-maps';
export { DEFAULT_MODE, isGameMode } from './lib/state/match/game-mode';
export type { GameMode } from './lib/state/match/game-mode';
export {
  add,
  clamp,
  clampLength,
  delta,
  distance,
  emptyBounds,
  growBounds,
  isSteering,
  length,
  lerp,
  NO_STEERING,
  randomSeed,
  scaleTo,
  seeded,
  streamSeed,
  wrap,
} from './lib/state/geometry';
export type { CellBounds, Point, SteeringVector } from './lib/state/geometry';
export { GhostController, NO_INPUT } from './lib/state/replay/ghost';
export type { GhostInputs, SeatDriver } from './lib/state/replay/ghost';
export { isInteger, isObject } from './lib/state/is-object';
export {
  GENERATED_ADJECTIVES,
  generatedLevel,
  heatOf,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  parseGeneratedId,
  rollLevelId,
  tuneSeed,
} from './lib/state/levels/generator/generate-level';
export { RECIPE_IDS, RECIPES } from './lib/state/levels/generator/recipes';
export type { RecipeId } from './lib/state/levels/generator/recipes';
export { Rng } from './lib/state/levels/generator/rng';
export {
  getLevel,
  gridScale,
  isBigMap,
  isLadderLevel,
  isLadderLevelId,
  isLevelId,
  levelBalance,
  levelCrosshairSpeed,
  levelDescriptionText,
  levelDifficulty,
  levelMap,
  levelNameText,
  LEVELS,
  levelSize,
  levelTitle,
  levelTitleText,
  nextLevel,
  ONLINE_LOCK_TEXT,
  ONLINE_LOCKS,
  playableOnline,
} from './lib/state/levels/levels';
export type { LadderLevelId, Level } from './lib/state/levels/levels';
export { coversPoint } from './lib/state/levels/maps';
export type { DynamicWall, Rect } from './lib/state/levels/maps';
export {
  cpuSimulation,
  DRAG_STEPS,
  MatchEngine,
  noFrameEvents,
  onGrid,
  STEER_STEPS,
} from './lib/state/match/match-engine';
export type {
  FrameEvents,
  MatchOptions,
  MatchResult,
  PlayerSpawn,
  SecondSampler,
  SizeSample,
} from './lib/state/match/match-engine';
export { MatchRun } from './lib/state/match/match-run';
export type {
  MatchArena,
  MatchRunResult,
  RunnableEngine,
} from './lib/state/match/match-run';
export {
  isMatchLevel,
  MATCH_LEVELS,
  pickMatchLevel,
} from './lib/state/levels/match-level';
export type {
  MatchLevelPick,
  PickedMatchLevel,
} from './lib/state/levels/match-level';
export { planMatch } from './lib/state/match/match-setup';
export type {
  MatchPlan,
  OnlineSeats,
  PlannedMatch,
} from './lib/state/match/match-setup';
export {
  isNewBest,
  judgeMatch,
  matchRecord,
  MEDAL_NAMES,
  MEDAL_TIERS,
  MEDAL_TIERS_RAREST_FIRST,
  medalFor,
  medalGoalText,
  medalRank,
  medalText,
} from './lib/state/progress/medallions';
export type {
  MatchRecord,
  MedalAward,
  MedalTier,
} from './lib/state/progress/medallions';
export { HEART_PERIOD_SEC } from './lib/state/levels/organic-maps';
export { perfProbeOf } from './lib/state/match/perf-probe';
export {
  createPlayer,
  isBoosted,
  isBoostReady,
  isWeaponReady,
} from './lib/state/match/player.model';
export type {
  Bacteria,
  Player,
  PlayerColorArray,
} from './lib/state/match/player.model';
export {
  addCouchWin,
  addDailyAttempt,
  addEndlessRun,
  addMedal,
  addTotals,
  adoptProgress,
  bestMedal,
  EMPTY_PROGRESS,
  medalTally,
  mergeProgress,
  NO_TOTALS,
  parseProgress,
  totalsOf,
} from './lib/state/progress/progress';
export type { LifetimeTotals, Progress } from './lib/state/progress/progress';
export { rankFor, RANKS, xpClimb } from './lib/state/progress/ranks';
export type { RankId } from './lib/state/progress/ranks';
export { keepRecent } from './lib/state/match/recent-cache';
export { onlineReplayId, PUBLIC_ID } from './lib/state/replay/replay-id';
export { replayFromHash, replayLink } from './lib/state/replay/replay-link';
export {
  MAX_PACKED_BYTES,
  MAX_UNPACKED_BYTES,
  packReplay,
  replayFromBytes,
  replayToBytes,
  unpackReplay,
} from './lib/state/replay/replay-pack';
export type { PackedReplay, PackOptions } from './lib/state/replay/replay-pack';
export {
  ARRIVAL_REASONS,
  DECLARED_REASONS,
  NOT_REPORTED,
  ONLINE_REASONS,
} from './lib/state/replay/replay-reasons';
export type {
  ArrivalReason,
  DeclaredReason,
  OnlineReason,
} from './lib/state/replay/replay-reasons';
export { replayScore } from './lib/state/replay/replay-score';
export { replayVerdict } from './lib/state/replay/replay-verdict';
export type { ReplayVerdict } from './lib/state/replay/replay-verdict';
export type {
  ReplayReason,
  ReplayScore,
  ReplayScoreInput,
} from './lib/state/replay/replay-score';
export {
  canPlayBack,
  EVOLVED_REPLAY_VERSION,
  GHOST_REPLAY_VERSION,
  GPU_INT_REPLAY_VERSION,
  LADDER_REPLAY_VERSION,
  MAX_TICKS,
  onOnlineGrid,
  parseReplay,
  playbackRefusal,
  playReplay,
  REPLAY_VERSION,
  replayEngine,
  replayOf,
  replayOutcome,
  replayRun,
  savedRegardless,
  simGridOf,
} from './lib/state/replay/replay';
export type {
  ParseOptions,
  PlayableReplay,
  PlaybackHeader,
  PlaybackRefusal,
  Replay,
  ReplayAttempt,
  ReplayBoost,
  ReplayDrag,
  ReplayExtras,
  ReplayHeader,
  ReplayInputs,
  ReplayOutcome,
  ReplayResult,
  ReplayRunOptions,
  ReplaySeat,
  ReplaySteer,
  ReplayWeapon,
} from './lib/state/replay/replay';
export {
  addSeriesMatch,
  formatScore,
  HEAD_STARTS,
  isHeadStart,
  isSeriesLength,
  newSeries,
  rivalryScore,
  SERIES_LENGTHS,
  seriesWinner,
  startScales,
} from './lib/state/match/rivalry';
export type {
  HeadStart,
  Series,
  SeriesLength,
} from './lib/state/match/rivalry';
export { decodeReport } from './lib/state/simulation/simulation-report';
export type { ReportLayout } from './lib/state/simulation/simulation-report';
export {
  isRuleset,
  rulesetOf,
  runsOnGpu,
} from './lib/state/simulation/simulation';
export {
  CPU_SIMULATIONS,
  createSimulationProvider,
} from './lib/state/simulation/simulation-provider';
export type {
  ArenaSize,
  DevicePlay,
  GpuSimulations,
  SimulationProvider,
  SimulationRequest,
  SimulationSources,
} from './lib/state/simulation/simulation-provider';
export type {
  BlockCounts,
  CellsLayer,
  ColonyLayer,
  ColonySummary,
  GridVariant,
  Ruleset,
  Simulation,
  SimulationFactory,
  SimulationVariant,
  StateLayer,
} from './lib/state/simulation/simulation';
export {
  BACTERIA_LOOKS,
  BOSS_LOOK,
  isBacteriaLook,
  skinCost,
  SKINS,
} from './lib/state/progress/skins';
export type { BacteriaLook, ColonyLook } from './lib/state/progress/skins';
export type { MissionId } from './lib/state/levels/training-levels';
export {
  addMission,
  firstOpenMission,
  isMissionDone,
  missionById,
  missionOf,
  missionResult,
  MISSIONS,
  missionsDone,
  missionShortfall,
} from './lib/state/levels/training';
export type { Mission } from './lib/state/levels/training';
export {
  activeArena,
  arenaLocks,
  arenaLockText,
  colorLocks,
  colorLockText,
  newCosmeticTexts,
} from './lib/state/progress/unlocks';
export { WEAPON_CODE } from './lib/state/simulation/weapon-effects';
export {
  ANNIHILATION,
  BOSS_SEAT,
  harvestTarget,
  holdTarget,
  judgeOutcome,
  ruleNoteText,
  timeLeft,
  winRuleOf,
} from './lib/state/match/win-conditions';
export type {
  EndReason,
  MatchOutcome,
  WinRule,
} from './lib/state/match/win-conditions';
export { COUCH_XP, matchXp, xpGain, xpOf } from './lib/state/progress/xp';
export type { XpMatch } from './lib/state/progress/xp';
export {
  kindOfCode,
  mapZones,
  stampZones,
  WALL_BIT,
  ZONE_CODE,
  ZONE_EFFECTS,
  ZONE_NAMES,
  ZONE_SHIFT,
} from './lib/state/levels/zones';
export type { Zone, ZoneKind } from './lib/state/levels/zones';
