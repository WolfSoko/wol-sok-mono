import { isObject } from '../storage/game-storage';
import { BOT_DIFFICULTIES, BotDifficulty } from './bot-controller';
import { betterMedal, MEDAL_TIERS, MedalTier } from './medallions';

/** What the game remembers of a player's matches against the computer. */
export interface Progress {
  /** The best medallion by level id, then by difficulty. */
  medals: Record<string, Partial<Record<BotDifficulty, MedalTier>>>;
}

export const EMPTY_PROGRESS: Progress = { medals: {} };

/** The best medallion of a level at a difficulty, null before the first. */
export function bestMedal(
  progress: Progress,
  levelId: string,
  difficulty: BotDifficulty
): MedalTier | null {
  return progress.medals[levelId]?.[difficulty] ?? null;
}

/** The progress with a medallion won - kept only where it beats the best. */
export function addMedal(
  progress: Progress,
  levelId: string,
  difficulty: BotDifficulty,
  medal: MedalTier
): Progress {
  const best = betterMedal(bestMedal(progress, levelId, difficulty), medal);
  return {
    medals: {
      ...progress.medals,
      [levelId]: { ...progress.medals[levelId], [difficulty]: best },
    },
  };
}

/**
 * The progress with the best medallion of either, per level and difficulty.
 * Merging can only gain, so progress from several tabs or devices converges
 * whatever order it is merged in.
 */
export function mergeProgress(progress: Progress, other: Progress): Progress {
  let merged = progress;
  for (const [levelId, byDifficulty] of Object.entries(other.medals)) {
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      const medal = byDifficulty[difficulty];
      if (medal != null) {
        merged = addMedal(merged, levelId, difficulty, medal);
      }
    }
  }
  return merged;
}

/**
 * The progress in a stored value, keeping every medallion it can read and
 * dropping the rest - a damaged entry must not cost the player the others.
 */
export function parseProgress(value: unknown): Progress {
  if (!isObject(value) || !isObject(value['medals'])) {
    return EMPTY_PROGRESS;
  }
  const medals: Progress['medals'] = {};
  for (const [levelId, byDifficulty] of Object.entries(value['medals'])) {
    if (!isObject(byDifficulty)) {
      continue;
    }
    for (const { id: difficulty } of BOT_DIFFICULTIES) {
      const medal = byDifficulty[difficulty];
      if (MEDAL_TIERS.includes(medal as MedalTier)) {
        medals[levelId] = {
          ...medals[levelId],
          [difficulty]: medal as MedalTier,
        };
      }
    }
  }
  return { medals };
}
