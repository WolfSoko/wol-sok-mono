import {
  type AchievementId,
  type BotDifficulty,
  type ChapterId,
  COLONY_COLORS,
  type ColonyColorId,
  colonyColorText,
  type LadderLevelId,
  type MedalTier,
  type MissionId,
  type RankId,
  type RecipeId,
  type SeriesLength,
  type ZoneKind,
} from '@wolsok/feat-shared-bacteria-engine';
import type {
  GameText,
  TranslationKey,
} from '@wolsok/feat-shared-bacteria-engine';

/*
 * The keys of the game data's texts, by the ids the state keeps: the state
 * and the engine stay in English and free of `I18nService`, the screens
 * translate. Each builder only takes the ids the game has, so a key that
 * is not in the dictionaries fails to compile.
 *
 * Texts that depend on a level as a whole, on numbers or on the progress
 * come from the state as a `GameText` (key and params), shown with the
 * `gameText` pipe - see the re-exports at the end.
 */

/** The title of a level of the ladder, without its number: "Hourglass". */
export function levelTitleKey(id: LadderLevelId): TranslationKey {
  return `levels.titles.${id}`;
}

/** The briefing of a level of the ladder. */
export function levelDescriptionKey(id: LadderLevelId): TranslationKey {
  return `levels.descriptions.${id}`;
}

/** A chapter's name and its line. */
export function chapterKeys(id: ChapterId): {
  name: TranslationKey;
  blurb: TranslationKey;
} {
  return {
    name: `levels.chapters.${id}.name`,
    blurb: `levels.chapters.${id}.blurb`,
  };
}

/** A style of generated level: its name in the level choice and briefing. */
export function recipeKeys(id: RecipeId): {
  label: TranslationKey;
  description: TranslationKey;
} {
  return {
    label: `levels.generated.styles.${id}.label`,
    description: `levels.generated.styles.${id}.description`,
  };
}

/**
 * An achievement's name and condition. The condition has placeholders -
 * show it through `achievementTexts(id).condition`, which fills them.
 */
export function achievementKeys(id: AchievementId): {
  name: TranslationKey;
  condition: TranslationKey;
} {
  return {
    name: `achievements.${id}.name`,
    condition: `achievements.${id}.condition`,
  };
}

/** A rank's name - `rankFor(xp).rank.id`. */
export function rankKey(id: RankId): TranslationKey {
  return `game.ranks.${id}`;
}

/** A medallion's name: "Gold". */
export function medalKey(tier: MedalTier): TranslationKey {
  return `game.medals.${tier}`;
}

/** The name of a kind of ground: "Antibiotic". */
export function zoneKey(kind: ZoneKind): TranslationKey {
  return `game.zones.${kind}`;
}

/** A colony colour's name - also a player's name between two players. */
export function colorKey(id: ColonyColorId): TranslationKey {
  return `game.colors.${id}`;
}

/** A training mission: its title, its briefing, its goal and a tip. */
export function missionKeys(id: MissionId): {
  title: TranslationKey;
  description: TranslationKey;
  goal: TranslationKey;
  tip: TranslationKey;
} {
  return {
    title: `training.missions.${id}.title`,
    description: `training.missions.${id}.description`,
    goal: `training.missions.${id}.goal`,
    tip: `training.missions.${id}.tip`,
  };
}

/** The computer's difficulty: its name and what it does. */
export function difficultyKeys(difficulty: BotDifficulty): {
  name: TranslationKey;
  description: TranslationKey;
} {
  return {
    name: `game.difficulties.${difficulty}.name`,
    description: `game.difficulties.${difficulty}.description`,
  };
}

/** The name of a series length: "Best of 3". */
export function seriesKey(bestOf: SeriesLength): TranslationKey {
  return SERIES_KEYS[bestOf];
}

const SERIES_KEYS: Readonly<Record<SeriesLength, TranslationKey>> = {
  1: 'game.series.one',
  3: 'game.series.three',
  5: 'game.series.five',
};

/** The names a match gives its players, by the name it gives them. */
const PLAYER_NAME_KEYS: Readonly<Record<string, TranslationKey>> = {
  You: 'game.players.you',
  Computer: 'game.players.computer',
  Ghost: 'game.players.ghost',
  Neutral: 'game.players.neutral',
  Dummy: 'game.players.dummy',
  ...Object.fromEntries(
    COLONY_COLORS.map(({ id, name }) => [name, colonyColorText(id).key])
  ),
};

/**
 * A player's name as the match set it up - "You", "Computer", "Ghost",
 * "Neutral", "Dummy" or a colour's English name - as a text to translate; null for
 * any other name, such as an online opponent's, which is shown as it is.
 */
export function playerNameText(name: string): GameText | null {
  const key = PLAYER_NAME_KEYS[name];
  return key === undefined ? null : { key };
}

export { english, renderGameText } from '@wolsok/feat-shared-bacteria-engine';
export type {
  GameText,
  GameTextParams,
  Translate,
} from '@wolsok/feat-shared-bacteria-engine';
export { GameTextPipe } from './game-text.pipe';
export { achievementTexts } from '@wolsok/feat-shared-bacteria-engine';
export {
  continueText,
  ladderLockText,
} from '@wolsok/feat-shared-bacteria-engine';
export { colonyColorText };
export {
  levelDescriptionText,
  levelNameText,
  levelTitleText,
  ONLINE_LOCK_TEXT,
} from '@wolsok/feat-shared-bacteria-engine';
export { medalGoalText, medalText } from '@wolsok/feat-shared-bacteria-engine';
export {
  arenaLockText,
  colorLockText,
} from '@wolsok/feat-shared-bacteria-engine';
export { ruleNoteText } from '@wolsok/feat-shared-bacteria-engine';
