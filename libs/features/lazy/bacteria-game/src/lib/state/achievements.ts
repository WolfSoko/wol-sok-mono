import { AchievementId } from './achievement-ids';
import { BOT_DIFFICULTIES } from './bot-controller';
import { LEVELS } from './levels';
import { MatchRecord } from './medallions';
import { bestMedal, Progress } from './progress';

/**
 * A lifetime goal: a short name, a one-line condition, and the test of it
 * against the progress after a match - and the match itself, null for one
 * between two players.
 */
export interface Achievement {
  id: AchievementId;
  name: string;
  condition: string;
  earned(progress: Progress, match: MatchRecord | null): boolean;
}

/** Wins this short earn Blitz, in seconds of match time. */
const BLITZ_SEC = 45;
/** Wins this long earn Siege. */
const SIEGE_SEC = 5 * 60;
/** Comeback asks to have fallen below this share of the computer's size. */
const COMEBACK_RATIO = 0.25;
/** Clean Sweep asks to lose fewer than this share of the peak colony. */
const CLEAN_SWEEP_LOSS_SHARE = 0.1;
/** Full Dish asks for a colony this close to the level's capacity. */
const FULL_DISH_SHARE = 0.95;
const GATEKEEPER_CRUSHED = 500;
const CONVERTER_CAPTURED = 10_000;
const COUCH_WAR_MATCHES = 10;
/** The levels Petri Scholar asks gold on - the first four, the classics. */
const SCHOLAR_LEVELS = LEVELS.slice(0, 4);

const won = (match: MatchRecord | null): match is MatchRecord =>
  match?.won === true;

const holds = (
  progress: Progress,
  levelId: string,
  accept: (tier: string | null) => boolean
): boolean =>
  BOT_DIFFICULTIES.some(({ id }) => accept(bestMedal(progress, levelId, id)));

/** Every achievement, in the order of the ids in achievement-ids.ts. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-blood',
    name: 'First Blood',
    condition: 'Win a match against the computer',
    earned: (progress) => progress.totals.wins > 0,
  },
  {
    id: 'pacifist',
    name: 'Pacifist',
    condition: 'Win without firing a boost',
    earned: (_, match) => won(match) && match.boostsFired === 0,
  },
  {
    id: 'blitz',
    name: 'Blitz',
    condition: `Win in under ${BLITZ_SEC} seconds`,
    earned: (_, match) => won(match) && match.durationSec < BLITZ_SEC,
  },
  {
    id: 'comeback',
    name: 'Comeback',
    condition: 'Win after falling below a quarter of the enemy’s size',
    earned: (_, match) => won(match) && match.lowestSizeRatio < COMEBACK_RATIO,
  },
  {
    id: 'siege',
    name: 'Siege',
    condition: 'Win a match longer than 5 minutes',
    earned: (_, match) => won(match) && match.durationSec > SIEGE_SEC,
  },
  {
    id: 'clean-sweep',
    name: 'Clean Sweep',
    condition: 'Win losing under 10 % of your colony at its peak',
    earned: (_, match) =>
      won(match) &&
      match.peakCount > 0 &&
      match.lost < CLEAN_SWEEP_LOSS_SHARE * match.peakCount,
  },
  {
    id: 'full-dish',
    name: 'Full Dish',
    condition: 'Grow your colony to the level’s capacity',
    earned: (_, match) => match !== null && match.peakShare >= FULL_DISH_SHARE,
  },
  {
    id: 'gatekeeper',
    name: 'Gatekeeper',
    condition: `Let walls crush ${GATEKEEPER_CRUSHED} enemy bacteria`,
    earned: (progress) => progress.totals.enemyCrushed >= GATEKEEPER_CRUSHED,
  },
  {
    id: 'converter',
    name: 'Converter',
    condition: 'Capture 10,000 enemy bacteria',
    earned: (progress) => progress.totals.captured >= CONVERTER_CAPTURED,
  },
  {
    id: 'flawless',
    name: 'Flawless',
    condition: 'Earn a platinum medallion',
    earned: (progress) =>
      LEVELS.some(({ id }) =>
        holds(progress, id, (tier) => tier === 'platinum')
      ),
  },
  {
    id: 'petri-scholar',
    name: 'Petri Scholar',
    condition: 'Gold on levels 1 to 4',
    earned: (progress) =>
      SCHOLAR_LEVELS.every(({ id }) =>
        holds(progress, id, (tier) => tier === 'gold' || tier === 'platinum')
      ),
  },
  {
    id: 'hard-boiled',
    name: 'Hard Boiled',
    condition: 'Win every level on Hard',
    earned: (progress) =>
      LEVELS.every(({ id }) => bestMedal(progress, id, 'hard') !== null),
  },
  {
    id: 'couch-war',
    name: 'Couch War',
    condition: `Play ${COUCH_WAR_MATCHES} matches between two players`,
    earned: (progress) => progress.totals.couchMatches >= COUCH_WAR_MATCHES,
  },
];

/** The achievement with that id. */
export function getAchievement(id: AchievementId): Achievement {
  const achievement = ACHIEVEMENTS.find((a) => a.id === id);
  if (achievement == null) {
    throw new Error(`No achievement ${id}`);
  }
  return achievement;
}

/**
 * The progress with every achievement the match earned marked on the day
 * given, and those achievements - none twice.
 */
export function earnAchievements(
  progress: Progress,
  match: MatchRecord | null,
  date: string
): { progress: Progress; earned: AchievementId[] } {
  const earned = ACHIEVEMENTS.filter(
    (achievement) =>
      progress.achievements[achievement.id] == null &&
      achievement.earned(progress, match)
  ).map(({ id }) => id);
  if (earned.length === 0) {
    return { progress, earned };
  }
  return {
    progress: {
      ...progress,
      achievements: {
        ...progress.achievements,
        ...Object.fromEntries(earned.map((id) => [id, date])),
      },
    },
    earned,
  };
}
