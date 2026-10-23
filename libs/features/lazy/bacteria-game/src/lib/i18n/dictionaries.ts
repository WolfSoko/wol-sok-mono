import { common as deCommon } from './de/common';
import { settings as deSettings } from './de/settings';
import { common as enCommon } from './en/common';
import { settings as enSettings } from './en/settings';
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
  common: enCommon,
  settings: enSettings,
} satisfies Dictionary;

export const DE: Translation<typeof EN> = {
  common: deCommon,
  settings: deSettings,
};

export const DICTIONARIES: Readonly<Record<Language, Dictionary>> = {
  en: EN,
  de: DE,
};

/** The dotted path of a text, such as `'settings.language.title'`. */
export type TranslationKey = EntryPath<typeof EN>;
