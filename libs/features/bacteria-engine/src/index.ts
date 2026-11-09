/**
 * The game's engine without Angular: the match, its simulation, replays,
 * levels, progress and the texts (ADR 0011). The game's UI, its Cloud
 * Functions and its admin area import it as
 * `@wolsok/feat-shared-bacteria-engine`; nothing imports a path inside it.
 *
 * Everything here stays free of Angular, NgRx, RxJS, Firebase and the DOM:
 * an oxlint override guards the imports, Jest runs the specs in Node, and
 * `engine-bundle.spec.ts` bundles this file to prove it.
 */
export { DE, DICTIONARIES, EN } from './lib/i18n/dictionaries';
export type { TranslationKey } from './lib/i18n/dictionaries';
export { english, renderGameText } from './lib/i18n/game-text';
export type { GameText, GameTextParams, Translate } from './lib/i18n/game-text';
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
export { ACHIEVEMENT_IDS } from './lib/state/achievement-ids';
export type { AchievementId } from './lib/state/achievement-ids';
export {
  ACHIEVEMENTS,
  achievementTexts,
  earnAchievements,
} from './lib/state/achievements';
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
export { ADMIN_STATS_FIGURES } from './lib/state/cloud-records/admin-stats';
export type {
  AdminStats,
  AdminStatsFigure,
} from './lib/state/cloud-records/admin-stats';
export {
  banHolds,
  mirroredBan,
  parseBan,
  parseMirroredBan,
} from './lib/state/cloud-records/ban';
export type { CloudBan, ToMillis } from './lib/state/cloud-records/ban';
export { HIDE_REASONS } from './lib/state/cloud-records/hide-reasons';
export type { HideReason } from './lib/state/cloud-records/hide-reasons';
export { NOTICE_TYPES } from './lib/state/cloud-records/notices';
export type { NoticeType } from './lib/state/cloud-records/notices';
export { REPLAY_KINDS, REPLAY_STATES } from './lib/state/cloud-records/replays';
export type {
  ReplayKind,
  ReplayState,
} from './lib/state/cloud-records/replays';
export {
  type StoredPlayback,
  storedPlaybackOf,
  storedPlaybackRefusal,
} from './lib/state/cloud-records/replay-playback';
export {
  COMMAND_ENVELOPE_KEYS,
  COMMAND_TTL_MS,
  CURATION_COMMAND_TYPES,
  hasOnlyCommandKeys,
  isCurationCommandType,
  parseCommandResult,
  parseReplayCommand,
  PLAYER_REPLAY_COMMAND_TYPES,
  REPLAY_COMMAND_TYPES,
} from './lib/state/command-documents';
export type {
  CommandResult,
  CurationCommandType,
  ReplayCommandType,
} from './lib/state/command-documents';
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
} from './lib/state/arena-size';
export type { ScreenResolution, SimResolution } from './lib/state/arena-size';
export {
  ARRIVAL_SLACK_MS,
  ATTEMPT_DAYS,
  attemptExpireAt,
  attemptSeed,
  attemptTaken,
  canDeclare,
  COUNTDOWN_MS,
  dailyAttemptId,
  dailyAttemptsLeft,
  dayAttemptIds,
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
  runsLeft,
  submissionDeadline,
  UPLOAD_WINDOW_MS,
} from './lib/state/attempts';
export type {
  Attempt,
  DailyAttempt,
  EndlessAttempt,
} from './lib/state/attempts';
export { BacteriaSimulation } from './lib/state/bacteria-simulation';
export type { ColonySpawn, Nutrient } from './lib/state/bacteria-simulation';
export { fromBase64, toBase64 } from './lib/state/base64';
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
  ENTRY_STATUSES,
  formatTag,
  isBoardId,
  isEntryId,
  isUtcDay,
  isVisible,
  NEXT_CANDIDATES,
  onlineSort,
  PAGE_ROWS,
  parseBoardId,
  posesAsLabel,
  showsName,
  TAG_COUNT,
  TOP_ROWS,
  topRows,
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
  BoardEntry,
  BoardId,
  BoardKind,
  BoardRef,
  BoardRow,
  EntryShow,
  EntryStatus,
} from './lib/state/boards';
export {
  BOT_DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  difficultyOption,
} from './lib/state/bot-controller';
export type { BotDifficulty, BotProfile } from './lib/state/bot-controller';
export {
  continueText,
  furthestOpenLevel,
  ladderLocks,
  ladderLockText,
  newlyUnlocked,
} from './lib/state/campaign';
export type { CampaignSummary } from './lib/state/campaign';
export { Cells } from './lib/state/cells';
export type { CellList } from './lib/state/cells';
export { CHAPTERS } from './lib/state/chapters';
export type { ChapterId } from './lib/state/chapters';
export { matchChecksum } from './lib/state/checksum';
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
} from './lib/state/colony-colors';
export type { ColonyColorId } from './lib/state/colony-colors';
export {
  computerLook,
  NEUTRAL_LOOK,
  seatLooks,
} from './lib/state/colony-looks';
export { computerLoadout } from './lib/state/computer-opponent';
export {
  attemptsOn,
  DAILY_ATTEMPTS,
  dailyLevelId,
  isDailyLevelId,
  standingStreak,
  utcDay,
} from './lib/state/daily';
export {
  computerProfile,
  LADDER_VERSION,
  targetWinRate,
} from './lib/state/difficulty-curve';
export type { MatchEarnings } from './lib/state/earnings';
export {
  afterMatch,
  ENDLESS_LIVES,
  endlessLevelId,
  isRunOver,
  newRun,
} from './lib/state/endless';
export type { EndlessRun } from './lib/state/endless';
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
} from './lib/state/evolution-progress';
export type { EvolutionProgress } from './lib/state/evolution-progress';
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
} from './lib/state/evolution';
export type {
  ActiveEffect,
  EvolvedTraits,
  Gene,
  GeneId,
  Loadout,
  WeaponFire,
  WeaponId,
} from './lib/state/evolution';
export {
  FEATURE_TOGGLE_KEYS,
  FEATURE_TOGGLES,
  featureToggles,
} from './lib/state/feature-toggles';
export type {
  FeatureToggle,
  FeatureToggles,
} from './lib/state/feature-toggles';
export {
  clock,
  countDown,
  TICK_MS,
  TICK_SEC,
  TickClock,
  TICKS_PER_SEC,
  ticksToMs,
} from './lib/state/fixed-tick';
export type { GameFrame } from './lib/state/fixed-tick';
export { FramePacer } from './lib/state/frame-pacer';
export {
  BALANCE_VERSION,
  colonyCapacity,
  gameBalance,
  NEUTRAL_TRAITS,
  PLAIN_TRAITS,
} from './lib/state/game-balance';
export type { ColonyTraits, GameBalance } from './lib/state/game-balance';
export { getMap } from './lib/state/game-maps';
export { DEFAULT_MODE, isGameMode } from './lib/state/game-mode';
export type { GameMode } from './lib/state/game-mode';
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
export { GhostController, NO_INPUT } from './lib/state/ghost';
export type { GhostInputs, SeatDriver } from './lib/state/ghost';
export {
  drawAt,
  frameSeed,
  pcg3d,
  PICK_OF_8_SHIFT,
  SALT,
  SALT_SPREAD,
  STEP_SALT_STRIDE,
  stepSalt,
} from './lib/state/gpu-int/draws';
export {
  chanceThreshold,
  mulQ14,
  ONE_Q14,
  Q14,
  Q14_DRAW_SHIFT,
  Q14_STATE_MAX,
  TARGET_MAX,
  TARGET_SHIFT,
  toQ14,
  toTarget,
  toUnsignedQ14,
} from './lib/state/gpu-int/fixed-point';
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
export {
  createIntFrameUniforms,
  DIVIDE_VARIANTS,
  DRAIN_SHIFT,
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
export { isqrt, unitQ14 } from './lib/state/gpu-int/int-math';
export {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
  readbacksToTake,
} from './lib/state/gpu-int/int-readback';
export {
  INT_KIND,
  INT_RECORD,
  IntPassScratch,
  intStateHash,
} from './lib/state/gpu-int/int-reference';
export type {
  IntCombatUniforms,
  IntGrid,
  IntPassUniforms,
} from './lib/state/gpu-int/int-reference';
export {
  intSimulation,
  IntReferencePasses,
} from './lib/state/gpu-int/int-reference-passes';
export {
  intColonyCounts,
  intReferenceTick,
} from './lib/state/gpu-int/int-tick';
export type { IntTickInputs } from './lib/state/gpu-int/int-tick';
export {
  INT_EFFECTS,
  INT_ENERGY_MAX,
  intMatchUniforms,
} from './lib/state/gpu-int/int-uniforms';
export type { IntMatchUniforms } from './lib/state/gpu-int/int-uniforms';
export {
  GPU_SELF_TEST_VERSION,
  SELF_TEST_GOLDEN,
} from './lib/state/gpu-int/self-test-golden';
export {
  playScenario,
  scenarioRandom,
  SELF_TEST_SCENARIO,
  selfTestVerdict,
  SIM_SCENARIOS,
  skirmish,
} from './lib/state/gpu-int/sim-scenarios';
export type {
  SelfTestVerdict,
  SimScenario,
} from './lib/state/gpu-int/sim-scenarios';
export {
  ENERGY_SCALE,
  LOSER_SHIFT,
  MAX_EFFECTS,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
  POISONED,
  RECORD_MASK,
  REPORT_EXTRA_ROWS,
  REPORT_ROWS,
} from './lib/state/grid-format';
export { GridWar, READBACK_SLOTS } from './lib/state/grid/grid-war';
export type {
  CellPasses,
  CellPassesHost,
  GridArena,
  GridFrame,
  GridTick,
  ReportSink,
} from './lib/state/grid/cell-passes';
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
} from './lib/state/level-generator/generate-level';
export { RECIPE_IDS, RECIPES } from './lib/state/level-generator/recipes';
export type { RecipeId } from './lib/state/level-generator/recipes';
export { Rng } from './lib/state/level-generator/rng';
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
} from './lib/state/levels';
export type { LadderLevelId, Level } from './lib/state/levels';
export { coversPoint } from './lib/state/maps';
export type { DynamicWall, Rect } from './lib/state/maps';
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
export { MatchRun } from './lib/state/match-run';
export type {
  MatchArena,
  MatchRunResult,
  RunnableEngine,
} from './lib/state/match-run';
export {
  isMatchLevel,
  MATCH_LEVELS,
  pickMatchLevel,
} from './lib/state/match-level';
export type { MatchLevelPick, PickedMatchLevel } from './lib/state/match-level';
export { planMatch } from './lib/state/match-setup';
export type {
  MatchPlan,
  OnlineSeats,
  PlannedMatch,
} from './lib/state/match-setup';
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
} from './lib/state/medallions';
export type {
  MatchRecord,
  MedalAward,
  MedalTier,
} from './lib/state/medallions';
export { HEART_PERIOD_SEC } from './lib/state/organic-maps';
export { perfProbeOf } from './lib/state/perf-probe';
export {
  createPlayer,
  isBoosted,
  isBoostReady,
  isWeaponReady,
} from './lib/state/player.model';
export type {
  Bacteria,
  Player,
  PlayerColorArray,
} from './lib/state/player.model';
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
} from './lib/state/progress';
export type { LifetimeTotals, Progress } from './lib/state/progress';
export type {
  RankedMatch,
  RankedOutcome,
  RankedRun,
  RankedRunOutcome,
  UnrankedReason,
} from './lib/state/ranked-match';
export { rankFor, RANKS, xpClimb } from './lib/state/ranks';
export type { RankId } from './lib/state/ranks';
export { keepRecent } from './lib/state/recent-cache';
export { onlineReplayId, PUBLIC_ID } from './lib/state/replay-id';
export { replayFromHash, replayLink } from './lib/state/replay-link';
export {
  MAX_PACKED_BYTES,
  MAX_UNPACKED_BYTES,
  packReplay,
  replayFromBytes,
  replayToBytes,
  unpackReplay,
} from './lib/state/replay-pack';
export type { PackedReplay, PackOptions } from './lib/state/replay-pack';
export {
  ARRIVAL_REASONS,
  DECLARED_REASONS,
  NOT_REPORTED,
  ONLINE_REASONS,
} from './lib/state/replay-reasons';
export type {
  ArrivalReason,
  DeclaredReason,
  OnlineReason,
} from './lib/state/replay-reasons';
export { replayScore } from './lib/state/replay-score';
export { replayVerdict } from './lib/state/replay-verdict';
export type { ReplayVerdict } from './lib/state/replay-verdict';
export type {
  ReplayReason,
  ReplayScore,
  ReplayScoreInput,
} from './lib/state/replay-score';
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
} from './lib/state/replay';
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
} from './lib/state/replay';
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
} from './lib/state/rivalry';
export type { HeadStart, Series, SeriesLength } from './lib/state/rivalry';
export { decodeReport } from './lib/state/simulation-report';
export type { ReportLayout } from './lib/state/simulation-report';
export { isRuleset, rulesetOf, runsOnGpu } from './lib/state/simulation';
export {
  CPU_SIMULATIONS,
  createSimulationProvider,
} from './lib/state/simulation-provider';
export type {
  ArenaSize,
  DevicePlay,
  GpuSimulations,
  SimulationProvider,
  SimulationRequest,
  SimulationSources,
} from './lib/state/simulation-provider';
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
} from './lib/state/simulation';
export {
  BACTERIA_LOOKS,
  BOSS_LOOK,
  isBacteriaLook,
  skinCost,
  SKINS,
} from './lib/state/skins';
export type { BacteriaLook, ColonyLook } from './lib/state/skins';
export type { MissionId } from './lib/state/training-levels';
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
} from './lib/state/training';
export type { Mission } from './lib/state/training';
export {
  activeArena,
  arenaLocks,
  arenaLockText,
  colorLocks,
  colorLockText,
  newCosmeticTexts,
} from './lib/state/unlocks';
export { WEAPON_CODE } from './lib/state/weapon-effects';
export {
  ANNIHILATION,
  BOSS_SEAT,
  harvestTarget,
  holdTarget,
  judgeOutcome,
  ruleNoteText,
  timeLeft,
  winRuleOf,
} from './lib/state/win-conditions';
export type {
  EndReason,
  MatchOutcome,
  WinRule,
} from './lib/state/win-conditions';
export { COUCH_XP, matchXp, xpGain, xpOf } from './lib/state/xp';
export type { XpMatch } from './lib/state/xp';
export {
  kindOfCode,
  mapZones,
  stampZones,
  WALL_BIT,
  ZONE_CODE,
  ZONE_EFFECTS,
  ZONE_NAMES,
  ZONE_SHIFT,
} from './lib/state/zones';
export type { Zone, ZoneKind } from './lib/state/zones';
