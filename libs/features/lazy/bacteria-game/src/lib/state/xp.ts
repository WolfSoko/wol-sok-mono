import { ACHIEVEMENT_IDS } from './achievement-ids';
import {
  BOT_DIFFICULTIES,
  BotDifficulty,
  difficultyOption,
} from './bot-controller';
import { isLadderLevel, LEVELS } from './levels';
import { MatchRecord, MEDAL_NAMES, MedalTier } from './medallions';
import { bestMedal, Progress } from './progress';

/**
 * XP is not stored as such: it follows from the progress. What a match is
 * worth on its own - finishing, winning, the difficulty - is counted as it
 * is played (`totals.matchXp`); what the player holds - the best medallion
 * of each level and difficulty, every achievement - is worth its XP as long
 * as it is held. So XP merges as cleanly as the progress does, never pays
 * the same thing twice, and players who held medallions before XP existed
 * have theirs from the start.
 */

/** One line of what a match earned in XP, for the result screen. */
export interface XpPart {
  label: string;
  xp: number;
}

/** What a match earned in XP, line by line. */
export interface XpGain {
  parts: readonly XpPart[];
  total: number;
}

/** XP for playing a match to the end, won or lost. */
const FINISH_XP = 20;
/** XP on top for winning against the computer. */
const WIN_XP = 80;
/** How much the computer's difficulty multiplies finishing and winning. */
const DIFFICULTY_FACTOR: Record<BotDifficulty, number> = {
  easy: 1,
  normal: 1.25,
  hard: 1.5,
};
/** XP a held medallion is worth - a better one replaces the one below. */
const MEDAL_XP: Record<MedalTier, number> = {
  bronze: 20,
  silver: 40,
  gold: 70,
  platinum: 120,
};
/** XP an achievement is worth. */
const ACHIEVEMENT_XP = 50;
/** XP for a match between two players. */
export const COUCH_XP = 15;

/** What a match against the computer is worth on its own. */
export function matchXp(record: MatchRecord): number {
  return Math.round(
    (FINISH_XP + (record.won ? WIN_XP : 0)) *
      DIFFICULTY_FACTOR[record.difficulty]
  );
}

/** The XP a player's progress is worth. */
export function xpOf(progress: Progress): number {
  let xp = progress.totals.matchXp;
  for (const { id: levelId } of LEVELS) {
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      const medal = bestMedal(progress, levelId, difficulty);
      xp += medal === null ? 0 : MEDAL_XP[medal];
    }
  }
  const achievements = ACHIEVEMENT_IDS.filter(
    (id) => progress.achievements[id] != null
  ).length;
  return xp + achievements * ACHIEVEMENT_XP;
}

/**
 * What a match earned, from the progress before and after it, line by
 * line: the match itself, a better medallion, the achievements.
 */
export function xpGain(
  before: Progress,
  after: Progress,
  record: MatchRecord | null
): XpGain {
  const parts: XpPart[] = [];
  if (record === null) {
    parts.push({ label: 'Two players', xp: COUCH_XP });
  } else {
    const difficulty = difficultyOption(record.difficulty)?.name ?? '';
    parts.push({
      label: `${record.won ? 'Win' : 'Played'} · ${difficulty}`,
      xp: matchXp(record),
    });
    const held = bestMedal(before, record.levelId, record.difficulty);
    const best = bestMedal(after, record.levelId, record.difficulty);
    // Only the ladder's medallions pay XP - see xpOf.
    const onLadder = isLadderLevel(record.levelId);
    if (onLadder && best !== null && best !== held) {
      parts.push({
        label: `${MEDAL_NAMES[best]} medallion, a new best`,
        xp: MEDAL_XP[best] - (held === null ? 0 : MEDAL_XP[held]),
      });
    }
  }
  const earned = ACHIEVEMENT_IDS.filter(
    (id) => before.achievements[id] == null && after.achievements[id] != null
  ).length;
  if (earned > 0) {
    parts.push({
      label: earned === 1 ? 'Achievement' : `${earned} achievements`,
      xp: earned * ACHIEVEMENT_XP,
    });
  }
  return { parts, total: parts.reduce((sum, { xp }) => sum + xp, 0) };
}
