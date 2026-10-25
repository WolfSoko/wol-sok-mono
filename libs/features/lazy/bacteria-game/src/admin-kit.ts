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
export type { FirebaseConnection } from './lib/storage/firebase-connection';

// The page's loading splash, which only the game itself takes down.
export { SPLASH_ID } from './lib/splash';

// The language the game speaks, and the helpers for a dictionary of its own.
export { I18nService } from './lib/i18n/i18n.service';
export { translate } from './lib/i18n/translation';
export type {
  Dictionary,
  EntryPath,
  Plural,
  Translation,
  TranslationParams,
} from './lib/i18n/translation';
export type { Language } from './lib/i18n/language';

// Players.
export { AvatarComponent } from './lib/social/avatar.component';
export { defaultProfile } from './lib/social/profile';
export type { Avatar, Profile } from './lib/social/profile';

// The contracts the admin views read and write.
export {
  BOARD_KINDS,
  dailyBoardId,
  isBoardId,
  parseBoardId,
  VISIBLE_STATUSES,
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
  ADMIN_COMMAND_TYPES,
  BAN_REASONS,
  DESTRUCTIVE_COMMAND_TYPES,
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
