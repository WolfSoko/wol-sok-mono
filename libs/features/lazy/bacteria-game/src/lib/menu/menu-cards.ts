import { arenaTheme, cssTriple } from '@wolsok/feat-bacteria-rendering';
import {
  levelTitleText,
  recipeKeys,
  renderGameText,
  type GameText,
} from '../i18n/game-texts';
import type { I18nService } from '../i18n/i18n.service';
import {
  DAILY_ATTEMPTS,
  getLevel,
  LEVELS,
  levelSize,
  parseGeneratedId,
} from '@wolsok/feat-shared-bacteria-engine';
import type { LevelCard } from './level-card.component';

/** Today's daily level as the menus show it. */
export interface DailyCard {
  levelId: string;
  /** The attempts of the day still to play, 0 once they are used. */
  attemptsLeft: number;
  /** Days in a row with a daily level won, 0 for none. */
  streak: number;
}

/** The line under the daily level: attempts left and the streak. */
export function dailyNoteText({ attemptsLeft, streak }: DailyCard): GameText {
  const attempts: GameText =
    attemptsLeft > 0
      ? {
          key: 'newGame.notes.attemptsLeft',
          params: { left: attemptsLeft, total: DAILY_ATTEMPTS },
        }
      : { key: 'newGame.notes.attemptsUsed' };
  return streak > 0
    ? { key: 'newGame.notes.streak', params: { attempts, count: streak } }
    : attempts;
}

/** The line under an endless run on the menus - the best run, once there is one. */
export function endlessNoteText(best: number): GameText {
  return best > 0
    ? { key: 'newGame.notes.endlessBest', params: { best } }
    : { key: 'newGame.notes.endless' };
}

/** The floor and the frame colour of a level's arena, as CSS triples. */
export function levelColors(id: string): { floor: string; edge: string } {
  const theme = arenaTheme(id);
  return { floor: cssTriple(theme.floor), edge: cssTriple(theme.border) };
}

/**
 * A level's card: its badge - its place on the ladder, or the style of a
 * generated one - its title in the active language, its arena's colours
 * and the size of its map, with the lock and the medallions the level
 * choice gives it (none by default).
 */
export function levelCard(
  id: string,
  t: I18nService['t'],
  extras: Pick<LevelCard, 'lock' | 'medals'> = { lock: null, medals: [] }
): LevelCard {
  const level = getLevel(id);
  const made = parseGeneratedId(id);
  return {
    id,
    badge:
      made === null
        ? String(LEVELS.indexOf(level) + 1)
        : t(recipeKeys(made.recipe).label),
    title: renderGameText(levelTitleText(level), t),
    ...levelColors(id),
    size: levelSize(level),
    ...extras,
  };
}
