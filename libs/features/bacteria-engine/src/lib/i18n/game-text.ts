import { ENGINE_EN, EngineTextKey } from './engine-texts';
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
 *
 * `K` is the keys a text may take: the engine's own by default; the game
 * widens it to all of its dictionaries' keys.
 */
export interface GameText<K extends string = EngineTextKey> {
  readonly key: K;
  readonly params?: GameTextParams<K>;
}

/** The values a game text's placeholders are filled with. */
export type GameTextParams<K extends string = EngineTextKey> = Readonly<
  Record<string, string | number | GameText<K>>
>;

/** Translates one key, as `I18nService.t` does. */
export type Translate<K extends string = EngineTextKey> = (
  key: K,
  params?: TranslationParams
) => string;

/** A game text, its nested texts first, through `t`. */
export function renderGameText<K extends string>(
  text: GameText<K>,
  t: Translate<K>
): string {
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
 * A text the engine builds in English, numbers formatted as in English -
 * what the state carries as its strings, and what the specs read.
 */
export function english(text: GameText): string {
  return renderGameText(text, (key, params) =>
    translate(ENGINE_EN, ENGINE_EN, key, 'en', params)
  );
}
