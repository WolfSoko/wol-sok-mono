import { english, GameText, GameTextParams } from '../i18n/game-text';
import { ACHIEVEMENT_IDS, AchievementId } from './achievement-ids';
import { goldOn, levelWon } from './campaign';
import { CHAPTERS } from './chapters';
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
/** The levels Petri Scholar asks gold on - the first chapter's. */
const SCHOLAR_LEVELS = CHAPTERS[0].levelIds;

const won = (match: MatchRecord | null): match is MatchRecord =>
  match?.won === true;

/**
 * The test of each achievement, and the values its condition's text is
 * filled with - name and condition come from the dictionaries.
 */
interface Rule {
  params?: GameTextParams;
  earned: Achievement['earned'];
}

const RULES: Record<AchievementId, Rule> = {
  'first-blood': {
    // A medallion is a win too - one won before the totals were counted.
    earned: (progress) =>
      progress.totals.wins > 0 ||
      LEVELS.some(({ id }) => levelWon(progress, id)),
  },
  pacifist: {
    earned: (_, match) => won(match) && match.boostsFired === 0,
  },
  blitz: {
    params: { seconds: BLITZ_SEC },
    earned: (_, match) => won(match) && match.durationSec < BLITZ_SEC,
  },
  comeback: {
    earned: (_, match) => won(match) && match.lowestSizeRatio < COMEBACK_RATIO,
  },
  siege: {
    params: { minutes: SIEGE_SEC / 60 },
    earned: (_, match) => won(match) && match.durationSec >= SIEGE_SEC,
  },
  'clean-sweep': {
    params: { percent: Math.round(CLEAN_SWEEP_LOSS_SHARE * 100) },
    earned: (_, match) =>
      won(match) &&
      match.peakCount > 0 &&
      match.lost < CLEAN_SWEEP_LOSS_SHARE * match.peakCount,
  },
  'full-dish': {
    earned: (_, match) => match !== null && match.peakShare >= FULL_DISH_SHARE,
  },
  gatekeeper: {
    params: { count: GATEKEEPER_CRUSHED },
    earned: (progress) => progress.totals.enemyCrushed >= GATEKEEPER_CRUSHED,
  },
  converter: {
    params: { count: CONVERTER_CAPTURED },
    earned: (progress) => progress.totals.captured >= CONVERTER_CAPTURED,
  },
  glutton: {
    params: { count: GLUTTON_PELLETS },
    earned: (progress) => progress.totals.pellets >= GLUTTON_PELLETS,
  },
  flawless: {
    earned: (progress) => medalTally(progress.medals).platinum > 0,
  },
  'petri-scholar': {
    params: { chapter: { key: `levels.chapters.${CHAPTERS[0].id}.name` } },
    earned: (progress) => SCHOLAR_LEVELS.every((id) => goldOn(progress, id)),
  },
  'hard-boiled': {
    earned: (progress) =>
      LEVELS.every(({ id }) => bestMedal(progress, id, 'hard') !== null),
  },
  'couch-war': {
    params: { count: COUCH_WAR_MATCHES },
    earned: (progress) => progress.totals.couchMatches >= COUCH_WAR_MATCHES,
  },
};

/** An achievement's name and condition as texts to translate. */
export function achievementTexts(id: AchievementId): {
  name: GameText;
  condition: GameText;
} {
  return {
    name: { key: `achievements.${id}.name` },
    condition: {
      key: `achievements.${id}.condition`,
      params: RULES[id].params,
    },
  };
}

/** The achievement with that id. */
export function getAchievement(id: AchievementId): Achievement {
  const { name, condition } = achievementTexts(id);
  return {
    id,
    name: english(name),
    condition: english(condition),
    earned: RULES[id].earned,
  };
}

/** Every achievement, in the order of {@link ACHIEVEMENT_IDS}. */
export const ACHIEVEMENTS: readonly Achievement[] =
  ACHIEVEMENT_IDS.map(getAchievement);

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
