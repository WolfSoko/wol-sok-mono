import { BotDifficulty, difficultyOption } from './bot-controller';
import { MatchRecord, MEDAL_NAMES, medalRank, MedalTier } from './medallions';

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
/** XP per medallion tier - in full for a new best, a quarter otherwise. */
const MEDAL_XP: Record<MedalTier, number> = {
  bronze: 20,
  silver: 40,
  gold: 70,
  platinum: 120,
};
/** XP per achievement earned. */
const ACHIEVEMENT_XP = 50;
/** XP for a match between two players. */
const COUCH_XP = 15;

/**
 * What a match against the computer earns: finishing, winning - both times
 * the difficulty - its medallion, and its achievements. Even a lost match
 * leaves something behind.
 */
export function xpForMatch(
  record: MatchRecord,
  medal: MedalTier | null,
  previousBest: MedalTier | null,
  achievements: number
): XpGain {
  const factor = DIFFICULTY_FACTOR[record.difficulty];
  const difficulty = difficultyOption(record.difficulty)?.name ?? '';
  const parts: XpPart[] = [
    {
      label: record.won ? `Win · ${difficulty}` : `Played · ${difficulty}`,
      xp: Math.round((FINISH_XP + (record.won ? WIN_XP : 0)) * factor),
    },
  ];
  if (medal !== null) {
    const newBest = medalRank(medal) > medalRank(previousBest);
    parts.push({
      label: `${MEDAL_NAMES[medal]} medallion${newBest ? ', a new best' : ''}`,
      xp: newBest ? MEDAL_XP[medal] : Math.round(MEDAL_XP[medal] / 4),
    });
  }
  return withAchievements(parts, achievements);
}

/** What a match between two players earns: playing, and its achievements. */
export function xpForCouchMatch(achievements: number): XpGain {
  return withAchievements(
    [{ label: 'Two players', xp: COUCH_XP }],
    achievements
  );
}

function withAchievements(parts: XpPart[], achievements: number): XpGain {
  if (achievements > 0) {
    parts.push({
      label:
        achievements === 1 ? 'Achievement' : `${achievements} achievements`,
      xp: achievements * ACHIEVEMENT_XP,
    });
  }
  return { parts, total: parts.reduce((sum, { xp }) => sum + xp, 0) };
}
