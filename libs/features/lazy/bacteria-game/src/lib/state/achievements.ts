import { ACHIEVEMENT_IDS, AchievementId } from './achievement-ids';
import { goldOn, levelWon } from './campaign';
import { LEVELS } from './levels';
import { MatchRecord } from './medallions';
import { bestMedal, medalTally, Progress } from './progress';

/**
 * A lifetime goal: a short name, a one-line condition, and the test of it
 * against the progress after a match - and the match itself, null when
 * there is none to judge: a match between two players, or the stored
 * progress as it loads.
 */
export interface Achievement {
  id: AchievementId;
  name: string;
  condition: string;
  earned(progress: Progress, match: MatchRecord | null): boolean;
}

/** Wins this short earn Blitz, in seconds of match time. */
const BLITZ_SEC = 45;
/** Wins this long earn Siege - whole seconds, as the match clock counts. */
const SIEGE_SEC = 5 * 60;
/** Comeback asks to have fallen below this share of the computer's size. */
const COMEBACK_RATIO = 0.25;
/** Clean Sweep asks to lose fewer than this share of the peak colony. */
const CLEAN_SWEEP_LOSS_SHARE = 0.1;
/** Full Dish asks for a colony this close to its capacity. */
const FULL_DISH_SHARE = 0.95;
const GATEKEEPER_CRUSHED = 500;
const CONVERTER_CAPTURED = 10_000;
const GLUTTON_PELLETS = 100;
const COUCH_WAR_MATCHES = 10;
/** The levels Petri Scholar asks gold on - the first four, the classics. */
const SCHOLAR_LEVELS = LEVELS.slice(0, 4);

const won = (match: MatchRecord | null): match is MatchRecord =>
  match?.won === true;

const RULES: Record<AchievementId, Omit<Achievement, 'id'>> = {
  'first-blood': {
    name: 'First Blood',
    condition: 'Win a match against the computer',
    // A medallion is a win too - one won before the totals were counted.
    earned: (progress) =>
      progress.totals.wins > 0 ||
      LEVELS.some(({ id }) => levelWon(progress, id)),
  },
  pacifist: {
    name: 'Pacifist',
    condition: 'Win without firing a boost',
    earned: (_, match) => won(match) && match.boostsFired === 0,
  },
  blitz: {
    name: 'Blitz',
    condition: `Win in under ${BLITZ_SEC} seconds`,
    earned: (_, match) => won(match) && match.durationSec < BLITZ_SEC,
  },
  comeback: {
    name: 'Comeback',
    condition: 'Win after falling below a quarter of the enemy’s size',
    earned: (_, match) => won(match) && match.lowestSizeRatio < COMEBACK_RATIO,
  },
  siege: {
    name: 'Siege',
    condition: 'Win a match of 5 minutes or more',
    earned: (_, match) => won(match) && match.durationSec >= SIEGE_SEC,
  },
  'clean-sweep': {
    name: 'Clean Sweep',
    condition: 'Win losing under 10 % of your colony at its peak',
    earned: (_, match) =>
      won(match) &&
      match.peakCount > 0 &&
      match.lost < CLEAN_SWEEP_LOSS_SHARE * match.peakCount,
  },
  'full-dish': {
    name: 'Full Dish',
    condition: 'Grow your colony as big as the dish lets it',
    earned: (_, match) => match !== null && match.peakShare >= FULL_DISH_SHARE,
  },
  gatekeeper: {
    name: 'Gatekeeper',
    condition: `Let walls crush ${GATEKEEPER_CRUSHED} enemy bacteria`,
    earned: (progress) => progress.totals.enemyCrushed >= GATEKEEPER_CRUSHED,
  },
  converter: {
    name: 'Converter',
    condition: 'Capture 10,000 enemy bacteria',
    earned: (progress) => progress.totals.captured >= CONVERTER_CAPTURED,
  },
  glutton: {
    name: 'Glutton',
    condition: `Eat up ${GLUTTON_PELLETS} pellets`,
    earned: (progress) => progress.totals.pellets >= GLUTTON_PELLETS,
  },
  flawless: {
    name: 'Flawless',
    condition: 'Earn a platinum medallion',
    earned: (progress) => medalTally(progress.medals).platinum > 0,
  },
  'petri-scholar': {
    name: 'Petri Scholar',
    condition: 'Gold on levels 1 to 4',
    earned: (progress) =>
      SCHOLAR_LEVELS.every(({ id }) => goldOn(progress, id)),
  },
  'hard-boiled': {
    name: 'Hard Boiled',
    condition: 'Win every level on Hard',
    earned: (progress) =>
      LEVELS.every(({ id }) => bestMedal(progress, id, 'hard') !== null),
  },
  'couch-war': {
    name: 'Couch War',
    condition: `Play ${COUCH_WAR_MATCHES} matches between two players`,
    earned: (progress) => progress.totals.couchMatches >= COUCH_WAR_MATCHES,
  },
};

/** Every achievement, in the order of {@link ACHIEVEMENT_IDS}. */
export const ACHIEVEMENTS: readonly Achievement[] = ACHIEVEMENT_IDS.map(
  (id) => ({ id, ...RULES[id] })
);

/** The achievement with that id. */
export function getAchievement(id: AchievementId): Achievement {
  return { id, ...RULES[id] };
}

/**
 * The progress with every achievement the match earned marked on the day
 * given, and those achievements - none twice. Without one, the progress
 * itself is checked.
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
