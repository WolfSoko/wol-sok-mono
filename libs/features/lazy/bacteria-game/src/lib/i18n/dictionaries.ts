import { achievements as deAchievements } from './de/achievements';
import { common as deCommon } from './de/common';
import { game as deGame } from './de/game';
import { levels as deLevels } from './de/levels';
import { settings as deSettings } from './de/settings';
import { achievements as enAchievements } from './en/achievements';
import { common as enCommon } from './en/common';
import { game as enGame } from './en/game';
import { levels as enLevels } from './en/levels';
import { settings as enSettings } from './en/settings';
import { online as deOnline } from './de/online';
import { online as enOnline } from './en/online';
import { profile as deProfile } from './de/profile';
import { profile as enProfile } from './en/profile';
import { social as deSocial } from './de/social';
import { social as enSocial } from './en/social';
import { help as deHelp } from './de/help';
import { help as enHelp } from './en/help';
import { menu as deMenu } from './de/menu';
import { menu as enMenu } from './en/menu';
import { newGame as deNewGame } from './de/new-game';
import { newGame as enNewGame } from './en/new-game';
import { match as deMatch } from './de/match';
import { match as enMatch } from './en/match';
import { controls as deControls } from './de/controls';
import { controls as enControls } from './en/controls';
import { stage as deStage } from './de/stage';
import { stage as enStage } from './en/stage';
import { support as deSupport } from './de/support';
import { support as enSupport } from './en/support';
import { site as deSite } from './de/site';
import { site as enSite } from './en/site';
import type { Language } from './language';
import type { Dictionary, EntryPath, Translation } from './translation';

/*
 * The texts, one area per screen or topic, so areas grow apart. A new area
 * takes three lines:
 *   1. `en/<area>.ts` exports `<area>`, a plain object of English texts;
 *   2. `de/<area>.ts` exports `<area>: Translation<typeof en>` with the
 *      German ones - a missing or an extra key fails to compile;
 *   3. one import and one entry per language below.
 */
export const EN = {
  stage: enStage,
  match: enMatch,
  controls: enControls,
  menu: enMenu,
  newGame: enNewGame,
  help: enHelp,
  social: enSocial,
  profile: enProfile,
  online: enOnline,
  common: enCommon,
  levels: enLevels,
  achievements: enAchievements,
  game: enGame,
  settings: enSettings,
  support: enSupport,
  site: enSite,
} satisfies Dictionary;

export const DE: Translation<typeof EN> = {
  stage: deStage,
  match: deMatch,
  controls: deControls,
  menu: deMenu,
  newGame: deNewGame,
  help: deHelp,
  social: deSocial,
  profile: deProfile,
  online: deOnline,
  common: deCommon,
  levels: deLevels,
  achievements: deAchievements,
  game: deGame,
  settings: deSettings,
  support: deSupport,
  site: deSite,
};

export const DICTIONARIES: Readonly<Record<Language, Dictionary>> = {
  en: EN,
  de: DE,
};

/** The dotted path of a text, such as `'settings.language.title'`. */
export type TranslationKey = EntryPath<typeof EN>;
