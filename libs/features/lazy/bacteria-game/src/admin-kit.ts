/**
 * What the admin area (`@wolsok/feat-lazy-bac-wars-admin`, ADR 0012) takes
 * from the game, imported as `@wolsok/feat-lazy-bac-game/admin-kit`: the
 * connection to the project, the language, the avatar and the contracts of
 * the boards and the admin commands. Never the game's routes or its
 * component, so the admin chunk does not pull the game in.
 */

// The project: the same one the game uses, one sign-in for both.
export { provideGameCloud } from './lib/storage/provide-game-cloud';
export { GameCloud } from './lib/storage/game-cloud';
export type { GameCloudOptions } from './lib/storage/game-cloud';
export type {
  FirebaseConnection,
  RemoteConfigConnection,
} from './lib/storage/firebase-connection';
export { isOwnerToken } from './lib/storage/owner-token';
export { readToggles } from './lib/storage/remote-config-game-toggles';

// The page's loading splash, which only the game itself takes down.
export { SPLASH_ID } from './lib/splash';

// The language the game speaks, and the helpers for a dictionary of its own.
export { I18nService } from './lib/i18n/i18n.service';
export { translate } from '@wolsok/feat-shared-bacteria-engine';
export type {
  Dictionary,
  EntryPath,
  Plural,
  Translation,
  TranslationParams,
} from '@wolsok/feat-shared-bacteria-engine';
export type { Language } from '@wolsok/feat-shared-bacteria-engine';
export type { TranslationKey } from '@wolsok/feat-shared-bacteria-engine';

// Players.
export { AvatarComponent } from './lib/social/avatar.component';
export {
  defaultProfile,
  parseProfile,
} from '@wolsok/feat-shared-bacteria-engine';
export type { Avatar, Profile } from '@wolsok/feat-shared-bacteria-engine';

// The contracts the admin views read and write.
export {
  BOARD_KINDS,
  competitionRanks,
  dailyBoardId,
  ENTRY_STATUSES,
  formatTag,
  isBoardId,
  isEntryId,
  isUtcDay,
  parseBoardId,
  VISIBLE_STATUSES,
} from '@wolsok/feat-shared-bacteria-engine';
export { utcDay } from '@wolsok/feat-shared-bacteria-engine';
export { BALANCE_VERSION } from '@wolsok/feat-shared-bacteria-engine';
export { ONLINE_SIM_RESOLUTION } from '@wolsok/feat-shared-bacteria-engine';
export type {
  BoardId,
  BoardKind,
  BoardRef,
  BoardRow,
  EntryShow,
  EntryStatus,
} from '@wolsok/feat-shared-bacteria-engine';
export {
  ADMIN_COMMAND_TYPES,
  BAN_REASONS,
  DESTRUCTIVE_COMMAND_TYPES,
  isUid,
  parseAdminCommand,
  REASON_MAX,
} from '@wolsok/feat-shared-bacteria-engine';
export type {
  AdminCommand,
  AdminCommandType,
  BanReason,
  EntryTarget,
  PlayerTarget,
} from '@wolsok/feat-shared-bacteria-engine';
export {
  ADMIN_STATS_FIGURES,
  banHolds,
  HIDE_REASONS,
  parseBan,
} from '@wolsok/feat-shared-bacteria-engine';
export type {
  AdminStats,
  AdminStatsFigure,
  CloudBan,
  HideReason,
} from '@wolsok/feat-shared-bacteria-engine';
export {
  FEATURE_TOGGLE_KEYS,
  FEATURE_TOGGLES,
} from '@wolsok/feat-shared-bacteria-engine';
export type {
  FeatureToggle,
  FeatureToggles,
} from '@wolsok/feat-shared-bacteria-engine';
