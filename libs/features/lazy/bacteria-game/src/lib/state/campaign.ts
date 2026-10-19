import { BOT_DIFFICULTIES } from './bot-controller';
import { levelTitle, LEVELS } from './levels';
import { bestMedal, Progress } from './progress';

/**
 * The campaign ladder: against the computer the first level is open, and
 * every other one opens once the level before it has been won at any
 * difficulty. A win always earns at least bronze, so the medallions tell
 * which levels were won - and a level won before, in free play or before
 * the ladder existed, stays open with its medallion.
 */

/** True once a level has been won against the computer at any difficulty. */
export function levelWon(progress: Progress, levelId: string): boolean {
  return BOT_DIFFICULTIES.some(
    ({ id }) => bestMedal(progress, levelId, id) !== null
  );
}

/**
 * Why each locked level is locked - "Win Corridors to unlock" - by level id;
 * the open ones are absent.
 */
export function ladderLocks(
  progress: Progress
): Readonly<Record<string, string>> {
  const locks: Record<string, string> = {};
  let previous: { title: string; won: boolean } | null = null;
  for (const level of LEVELS) {
    const won = levelWon(progress, level.id);
    if (previous !== null && !previous.won && !won) {
      locks[level.id] = `Win ${previous.title} to unlock`;
    }
    previous = { title: levelTitle(level), won };
  }
  return locks;
}

/** The furthest level the ladder has opened, given its locks. */
export function furthestOpenLevel(
  locks: Readonly<Record<string, string>>
): string {
  return LEVELS.findLast((level) => !(level.id in locks))?.id ?? LEVELS[0].id;
}
