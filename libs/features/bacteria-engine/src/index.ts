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
export { game } from './lib/i18n/en/game';
export { levels } from './lib/i18n/en/levels';
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
