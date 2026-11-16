import { achievements } from './en/achievements';
import { game } from './en/game';
import { levels } from './en/levels';
import { training } from './en/training';
import type { Dictionary, EntryPath } from './translation';

/*
 * The English texts the engine renders itself - a level's name, an
 * achievement, an XP line, a lock - through `english()`, so its state can
 * carry them as strings. Only the areas the engine builds keys in live
 * here; every other text, and every German one, is the game's
 * (`feat-lazy-bacteria-game`, `i18n/texts/`), so a copy edit there leaves
 * the engine, its goldens and the functions' deploy alone.
 */
export const ENGINE_EN = {
  levels,
  achievements,
  game,
  training,
} satisfies Dictionary;

/** The dotted path of a text the engine renders, such as `'game.medals.gold'`. */
export type EngineTextKey = EntryPath<typeof ENGINE_EN>;
