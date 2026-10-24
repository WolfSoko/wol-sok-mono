import { english, GameText } from '../i18n/game-text';
import { BOT_DIFFICULTIES, BotDifficulty } from './bot-controller';
import {
  getLevel,
  levelNameText,
  levelTitleText,
  LEVELS,
  previousLevel,
} from './levels';
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
  /** The continue label as a text to translate. */
  continueText?: GameText;
}

/** Where Continue picks up - "5 · Pillar Field · Normal" - to translate. */
export function continueText(
  levelId: string,
  difficulty: BotDifficulty
): GameText {
  return {
    key: 'game.continue',
    params: {
      level: levelNameText(getLevel(levelId)),
      difficulty: { key: `game.difficulties.${difficulty}.name` },
    },
  };
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
  return Object.fromEntries(
    Object.entries(ladderLockTexts(progress)).map(([id, text]) => [
      id,
      english(text),
    ])
  );
}

/** {@link ladderLocks} as texts to translate. */
export function ladderLockTexts(
  progress: Progress
): Readonly<Record<string, GameText>> {
  const locks: Record<string, GameText> = {};
  let previousWon: boolean | null = null;
  for (const level of LEVELS) {
    const won = levelWon(progress, level.id);
    if (previousWon === false && !won) {
      locks[level.id] = ladderLockText(level.id);
    }
    previousWon = won;
  }
  return locks;
}

/**
 * Why a level of the ladder is locked, while it is: "Win Corridors to
 * unlock", after the level before it.
 */
export function ladderLockText(levelId: string): GameText {
  return {
    key: 'levels.locks.ladder',
    params: { title: levelTitleText(previousLevel(levelId) ?? LEVELS[0]) },
  };
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
