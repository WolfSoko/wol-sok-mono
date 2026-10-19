import { AchievementId, isAchievementId } from './achievement-ids';
import { BOT_DIFFICULTIES, BotDifficulty } from './bot-controller';
import { isObject } from './is-object';
import { LEVELS } from './levels';
import { betterMedal, MEDAL_TIERS, MedalTier } from './medallions';

/** What a player has done over all their matches. */
export interface LifetimeTotals {
  /** Matches against the computer played to the end. */
  matches: number;
  /** Matches against the computer won. */
  wins: number;
  /** Enemy bacteria captured in matches against the computer. */
  captured: number;
  /** Enemy bacteria the walls crushed in matches against the computer. */
  enemyCrushed: number;
  /** Matches between two players played to the end. */
  couchMatches: number;
}

/** What the game remembers of a player's matches. */
export interface Progress {
  /** The best medallion by level id, then by difficulty. */
  medals: Record<string, Partial<Record<BotDifficulty, MedalTier>>>;
  totals: LifetimeTotals;
  /** The day each achievement was earned, as an ISO date. */
  achievements: Partial<Record<AchievementId, string>>;
}

export const NO_TOTALS: LifetimeTotals = {
  matches: 0,
  wins: 0,
  captured: 0,
  enemyCrushed: 0,
  couchMatches: 0,
};

const TOTAL_KEYS = Object.keys(NO_TOTALS) as (keyof LifetimeTotals)[];

export const EMPTY_PROGRESS: Progress = {
  medals: {},
  totals: NO_TOTALS,
  achievements: {},
};

/**
 * How many medallions of each tier are held, over the levels and the
 * difficulties of the game - a level the stored progress knows but the game
 * no longer has does not count.
 */
export function medalTally(
  medals: Progress['medals']
): Record<MedalTier, number> {
  const tally: Record<MedalTier, number> = {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
  };
  for (const { id } of LEVELS) {
    for (const tier of Object.values(medals[id] ?? {})) {
      tally[tier]++;
    }
  }
  return tally;
}

/** The best medallion of a level at a difficulty, null before the first. */
export function bestMedal(
  progress: Progress,
  levelId: string,
  difficulty: BotDifficulty
): MedalTier | null {
  return progress.medals[levelId]?.[difficulty] ?? null;
}

/**
 * The progress with a medallion won - kept only where it beats the best.
 * Without a better medallion it is the progress given, so a signal holding
 * it does not notify for nothing.
 */
export function addMedal(
  progress: Progress,
  levelId: string,
  difficulty: BotDifficulty,
  medal: MedalTier
): Progress {
  const held = bestMedal(progress, levelId, difficulty);
  const best = betterMedal(held, medal);
  if (best === held) {
    return progress;
  }
  return {
    ...progress,
    medals: {
      ...progress.medals,
      [levelId]: { ...progress.medals[levelId], [difficulty]: best },
    },
  };
}

/** The progress with a match's numbers added to the lifetime totals. */
export function addTotals(
  progress: Progress,
  match: Partial<LifetimeTotals>
): Progress {
  const totals = { ...progress.totals };
  for (const key of TOTAL_KEYS) {
    totals[key] += match[key] ?? 0;
  }
  return { ...progress, totals };
}

/**
 * The progress with the best of either: the better medallion per level and
 * difficulty, the higher of each total and the earlier day of each
 * achievement. Merging can only gain, so progress from several tabs or
 * devices converges whatever order it is merged in. Without a gain it is
 * the progress given.
 *
 * A total takes the higher of the two, not their sum, so a device that
 * catches up on another's matches counts them once. Matches played on two
 * devices at the same time, offline, count only on the one that played more.
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
  if (TOTAL_KEYS.some((key) => other.totals[key] > merged.totals[key])) {
    const totals = { ...merged.totals };
    for (const key of TOTAL_KEYS) {
      totals[key] = Math.max(totals[key], other.totals[key]);
    }
    merged = { ...merged, totals };
  }
  const earlier = (
    Object.entries(other.achievements) as [AchievementId, string][]
  ).filter(([id, date]) => {
    const held = merged.achievements[id];
    return held == null || date < held;
  });
  if (earlier.length > 0) {
    merged = {
      ...merged,
      achievements: { ...merged.achievements, ...Object.fromEntries(earlier) },
    };
  }
  return merged;
}

/**
 * The progress in a stored value, keeping everything it can read and
 * dropping the rest - a damaged entry must not cost the player the others.
 * Progress stored before totals and achievements existed reads with none.
 */
export function parseProgress(value: unknown): Progress {
  if (!isObject(value)) {
    return EMPTY_PROGRESS;
  }
  return {
    medals: parseMedals(value['medals']),
    totals: parseTotals(value['totals']),
    achievements: parseAchievements(value['achievements']),
  };
}

function parseMedals(value: unknown): Progress['medals'] {
  const medals: Progress['medals'] = {};
  if (!isObject(value)) {
    return medals;
  }
  for (const [levelId, byDifficulty] of Object.entries(value)) {
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
  return medals;
}

function parseTotals(value: unknown): LifetimeTotals {
  const totals = { ...NO_TOTALS };
  if (!isObject(value)) {
    return totals;
  }
  for (const key of TOTAL_KEYS) {
    const count = value[key];
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
      totals[key] = Math.floor(count);
    }
  }
  return totals;
}

function parseAchievements(value: unknown): Progress['achievements'] {
  const achievements: Progress['achievements'] = {};
  if (!isObject(value)) {
    return achievements;
  }
  for (const [id, date] of Object.entries(value)) {
    if (isAchievementId(id) && typeof date === 'string') {
      achievements[id] = date;
    }
  }
  return achievements;
}
