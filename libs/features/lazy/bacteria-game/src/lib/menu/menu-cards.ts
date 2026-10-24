import { arenaTheme, cssTriple } from '../arena/arena-theme';
import type { GameText } from '../i18n/game-texts';
import { DAILY_ATTEMPTS } from '../state/daily';

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
