import { BOT_DIFFICULTIES } from './bot-controller';
import { levelTitle, LEVELS } from './levels';
import { medalRank, MedalTier } from './medallions';
import { bestMedal, Progress } from './progress';

/** Where the player stands on the campaign ladder, for the main menu. */
export interface CampaignSummary {
  openLevels: number;
  /** Medallions held per tier, over every level and difficulty. */
  medals: Readonly<Record<MedalTier, number>>;
  /** Achievements earned. */
  achievements: number;
  /** Experience so far, which decides the rank. */
  xp: number;
  /** "5 · Pillar Field · Normal" - where Continue picks up. */
  continueLabel: string;
}

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

/** True once a level holds gold or better at any difficulty. */
export function goldOn(progress: Progress, levelId: string): boolean {
  return BOT_DIFFICULTIES.some(
    ({ id }) => medalRank(bestMedal(progress, levelId, id)) >= medalRank('gold')
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

/** The levels a change of the ladder's locks opened, in the ladder's order. */
export function newlyUnlocked(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>
): string[] {
  return LEVELS.filter(({ id }) => id in before && !(id in after)).map(
    ({ id }) => id
  );
}

/** The furthest level the ladder has opened, given its locks. */
export function furthestOpenLevel(
  locks: Readonly<Record<string, string>>
): string {
  return LEVELS.findLast((level) => !(level.id in locks))?.id ?? LEVELS[0].id;
}
