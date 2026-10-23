import { EN, TranslationKey } from './dictionaries';
import { translate, TranslationParams } from './translation';

/**
 * A text the game state builds - a medallion's hint, an XP line, a lock -
 * as a key and the values for its placeholders, so the screen shows it in
 * the active language. A value can be a text of its own: the medallion's
 * name in its hint, the level's title in a lock.
 *
 * The state stays free of `I18nService`, which the engine never sees: it
 * builds these, and takes its English strings from them through
 * {@link english}.
 */
export interface GameText {
  readonly key: TranslationKey;
  readonly params?: GameTextParams;
}

/** The values a game text's placeholders are filled with. */
export type GameTextParams = Readonly<
  Record<string, string | number | GameText>
>;

/** Translates one key, as `I18nService.t` does. */
export type Translate = (
  key: TranslationKey,
  params?: TranslationParams
) => string;

/** A game text, its nested texts first, through `t`. */
export function renderGameText(text: GameText, t: Translate): string {
  if (text.params === undefined) {
    return t(text.key);
  }
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(text.params)) {
    params[name] = typeof value === 'object' ? renderGameText(value, t) : value;
  }
  return t(text.key, params);
}

/**
 * A game text in English, numbers formatted as in English - what the state
 * carries as its strings, and what the specs read.
 */
export function english(text: GameText): string {
  return renderGameText(text, (key, params) =>
    translate(EN, EN, key, 'en', params)
  );
}
