/**
 * The cloud contract (ADR 0011, 0012): the documents the game, its Cloud
 * Functions and the admin area exchange (boards, attempts, commands, the
 * cloud records and the feature toggles), their ids, parsers and sorts,
 * all declared under `lib/state/cloud/`. Imported as
 * `@wolsok/feat-shared-bacteria-engine/cloud`; the main entry exports
 * none of it. A name enters it with its first consumer outside the engine.
 */
export {
  ADMIN_COMMAND_TYPES,
  BAN_REASONS,
  DESTRUCTIVE_COMMAND_TYPES,
  isUid,
  parseAdminCommand,
  REASON_MAX,
} from './lib/state/cloud/admin-commands';
export type {
  AdminCommand,
  AdminCommandType,
  BanReason,
  EntryTarget,
  PlayerTarget,
} from './lib/state/cloud/admin-commands';
export { ADMIN_STATS_FIGURES } from './lib/state/cloud/records/admin-stats';
export type {
  AdminStats,
  AdminStatsFigure,
} from './lib/state/cloud/records/admin-stats';
export {
  banHolds,
  mirroredBan,
  parseBan,
  parseMirroredBan,
} from './lib/state/cloud/records/ban';
export type { CloudBan } from './lib/state/cloud/records/ban';
export { HIDE_REASONS } from './lib/state/cloud/records/hide-reasons';
export type { HideReason } from './lib/state/cloud/records/hide-reasons';
export { NOTICE_TYPES } from './lib/state/cloud/records/notices';
export type { NoticeType } from './lib/state/cloud/records/notices';
export {
  parseRelayCredentials,
  parseTurnKey,
  RELAY_COLLECTION,
  RELAY_DOC_ID,
  relayCredentialsUrl,
  relayEntry,
} from './lib/state/cloud/records/relay';
export type {
  RelayCredentials,
  RelayEntry,
  TurnKey,
} from './lib/state/cloud/records/relay';
export { REPLAY_KINDS, REPLAY_STATES } from './lib/state/cloud/records/replays';
export type {
  ReplayKind,
  ReplayState,
} from './lib/state/cloud/records/replays';
export {
  type StoredPlayback,
  storedPlaybackOf,
  storedPlaybackRefusal,
} from './lib/state/cloud/records/replay-playback';
export {
  COMMAND_ENVELOPE_KEYS,
  COMMAND_TTL_MS,
  CURATION_COMMAND_TYPES,
  isCurationCommandType,
  parseCommandResult,
  parseReplayCommand,
} from './lib/state/cloud/command-documents';
export type {
  CommandResult,
  CurationCommandType,
  ReplayCommandType,
} from './lib/state/cloud/command-documents';
export {
  parsePlayGamesSignIn,
  PLAY_GAMES_CLAIM,
  PLAY_GAMES_CODE_MAX,
  PLAY_GAMES_FRAGMENT_KEY,
  PLAY_GAMES_LINKS,
  PLAY_GAMES_SIGN_INS,
  PLAY_GAMES_TOKEN_KEY,
  PLAY_GAMES_TOKEN_UID_KEY,
  playGamesCodeOf,
} from './lib/state/cloud/play-games-sign-in';
export type {
  PlayGamesSignIn,
  PlayGamesSignInError,
} from './lib/state/cloud/play-games-sign-in';
export {
  ATTEMPT_DAYS,
  attemptExpireAt,
  attemptSeed,
  attemptTaken,
  COUNTDOWN_MS,
  dailyAttemptsLeft,
  dayAttemptIds,
  declaredBeforeMatch,
  endlessAttemptId,
  isRankedPlan,
  nextDailyAttemptId,
  nextRunId,
  parseAttemptId,
  RANKED_DAILY_ATTEMPTS,
  RANKED_RUNS_PER_DAY,
  rankedPlan,
  runsLeft,
  submissionDeadline,
} from './lib/state/cloud/attempts';
export type { Attempt } from './lib/state/cloud/attempts';
export {
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
  TOP_ROWS,
  topRows,
  VISIBLE_STATUSES,
  XP_FULL_COUNT,
  XP_FULL_COUNT_BEFORE,
  xpRiseCap,
  xpSort,
} from './lib/state/cloud/boards';
export type {
  BoardEntry,
  BoardId,
  BoardKind,
  BoardRef,
  BoardRow,
  EntryShow,
  EntryStatus,
} from './lib/state/cloud/boards';
export {
  FEATURE_TOGGLE_KEYS,
  FEATURE_TOGGLES,
  featureToggles,
} from './lib/state/cloud/feature-toggles';
export type {
  FeatureToggle,
  FeatureToggles,
} from './lib/state/cloud/feature-toggles';
export type {
  RankedMatch,
  RankedOutcome,
  RankedRun,
  RankedRunOutcome,
  UnrankedReason,
} from './lib/state/cloud/ranked-match';
