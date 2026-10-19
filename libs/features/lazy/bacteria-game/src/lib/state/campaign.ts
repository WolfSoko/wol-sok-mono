import { BOT_DIFFICULTIES } from './bot-controller';
import { levelTitle, LEVELS } from './levels';
import { bestMedal, Progress } from './progress';

/**
 * The campaign ladder: against the computer the first level is open, and
 * every other one opens once the level before it has been won at any
 * difficulty. A win always earns at least bronze, so the medallions tell
 * which levels were won.
 */

/** True once a level has been won against the computer at any difficulty. */
export function levelWon(progress: Progress, levelId: string): boolean {
  return BOT_DIFFICULTIES.some(
    ({ id }) => bestMedal(progress, levelId, id) !== null
  );
}

/**
 * Why a level is still locked on the ladder - "Win Corridors to unlock" -
 * or null when it is open.
 */
export function lockedReason(
  progress: Progress,
  levelId: string
): string | null {
  const index = LEVELS.findIndex((level) => level.id === levelId);
  if (index <= 0) {
    return null;
  }
  const previous = LEVELS[index - 1];
  return levelWon(progress, previous.id)
    ? null
    : `Win ${levelTitle(previous)} to unlock`;
}
