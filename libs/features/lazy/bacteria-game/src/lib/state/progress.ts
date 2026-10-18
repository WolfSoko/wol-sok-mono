import { BOT_DIFFICULTIES, BotDifficulty } from './bot-controller';
import { betterMedal, MatchRecord, MEDAL_TIERS, MedalTier } from './medallions';

/** The best a player has done on one level at one difficulty, once won. */
export interface LevelRecord {
  /** The best medallion earned. */
  medal: MedalTier | null;
  wins: number;
  /** The fastest win in seconds of match time. */
  bestWinSec: number;
}

/** What the game remembers of a player's matches against the computer. */
export interface Progress {
  /** By level id, then by difficulty. */
  levels: Record<string, Partial<Record<BotDifficulty, LevelRecord>>>;
}

export const EMPTY_PROGRESS: Progress = { levels: {} };

/** The record of a level at a difficulty, null before it was won. */
export function levelRecord(
  progress: Progress,
  levelId: string,
  difficulty: BotDifficulty
): LevelRecord | null {
  return progress.levels[levelId]?.[difficulty] ?? null;
}

/** The progress with one more match in it. A match that was lost leaves no trace. */
export function applyMatch(
  progress: Progress,
  record: MatchRecord,
  medal: MedalTier | null
): Progress {
  if (!record.won) {
    return progress;
  }
  const before = levelRecord(progress, record.levelId, record.difficulty);
  const after: LevelRecord = {
    medal: betterMedal(before?.medal ?? null, medal),
    wins: (before?.wins ?? 0) + 1,
    bestWinSec: Math.min(before?.bestWinSec ?? Infinity, record.durationSec),
  };
  return {
    ...progress,
    levels: {
      ...progress.levels,
      [record.levelId]: {
        ...progress.levels[record.levelId],
        [record.difficulty]: after,
      },
    },
  };
}

/**
 * The progress in a stored value, keeping every record it can read and
 * dropping the rest - a damaged entry must not cost the player the others.
 */
export function parseProgress(value: unknown): Progress {
  if (!isObject(value) || !isObject(value['levels'])) {
    return EMPTY_PROGRESS;
  }
  const levels: Progress['levels'] = {};
  for (const [levelId, byDifficulty] of Object.entries(value['levels'])) {
    if (!isObject(byDifficulty)) {
      continue;
    }
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      const record = parseLevelRecord(byDifficulty[difficulty]);
      if (record != null) {
        levels[levelId] = { ...levels[levelId], [difficulty]: record };
      }
    }
  }
  return { levels };
}

function parseLevelRecord(value: unknown): LevelRecord | null {
  if (!isObject(value)) {
    return null;
  }
  const { medal, wins, bestWinSec } = value;
  if (typeof wins !== 'number' || typeof bestWinSec !== 'number') {
    return null;
  }
  return {
    medal: MEDAL_TIERS.includes(medal as MedalTier)
      ? (medal as MedalTier)
      : null,
    wins,
    bestWinSec,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
