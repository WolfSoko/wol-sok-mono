import { AchievementId, isAchievementId } from './achievement-ids';
import { BOT_DIFFICULTIES, BotDifficulty } from './bot-controller';
import { isColonyColor } from './colony-colors';
import { addAttempt, DailyRecord } from './daily';
import { isInteger, isObject } from './is-object';
import { LEVELS } from './levels';
import { betterMedal, MatchRecord, MEDAL_TIERS, MedalTier } from './medallions';
import { isMissionId, MissionId } from './training-levels';

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
  /** Pellets eaten up in matches against the computer. */
  pellets: number;
  /** Matches between two players played to the end. */
  couchMatches: number;
  /**
   * The XP the matches were worth on their own - finishing, winning, the
   * difficulty. The rest of the XP follows from what is held (xp.ts).
   */
  matchXp: number;
}

/** What the game remembers of a player's matches. */
export interface Progress {
  /** The best medallion by level id, then by difficulty. */
  medals: Record<string, Partial<Record<BotDifficulty, MedalTier>>>;
  totals: LifetimeTotals;
  /** The day each achievement was earned, as an ISO date. */
  achievements: Partial<Record<AchievementId, string>>;
  /**
   * Matches between two players won, by the colour of the winning colony -
   * the rivalry on this device, "Orange leads 14 : 9".
   */
  couchWins: Partial<Record<string, number>>;
  /** The daily level: the last day played, its attempts and the streak. */
  daily: DailyRecord | null;
  /** The most levels beaten in one endless run. */
  endlessBest: number;
  /** The day each training mission was done, as an ISO date. */
  training: Partial<Record<MissionId, string>>;
}

export const NO_TOTALS: LifetimeTotals = {
  matches: 0,
  wins: 0,
  captured: 0,
  enemyCrushed: 0,
  pellets: 0,
  couchMatches: 0,
  matchXp: 0,
};

const TOTAL_KEYS = Object.keys(NO_TOTALS) as (keyof LifetimeTotals)[];

export const EMPTY_PROGRESS: Progress = {
  medals: {},
  totals: NO_TOTALS,
  achievements: {},
  couchWins: {},
  daily: null,
  endlessBest: 0,
  training: {},
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

/** What a match against the computer adds to the lifetime totals. */
export function totalsOf(record: MatchRecord): Partial<LifetimeTotals> {
  return {
    matches: 1,
    wins: record.won ? 1 : 0,
    captured: record.captured,
    enemyCrushed: record.enemyCrushed,
    pellets: record.pellets,
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

/** The progress with matches between two players won by a colour, one by default. */
export function addCouchWin(
  progress: Progress,
  colorId: string,
  wins = 1
): Progress {
  return {
    ...progress,
    couchWins: {
      ...progress.couchWins,
      [colorId]: (progress.couchWins[colorId] ?? 0) + wins,
    },
  };
}

/** The progress with an endless run that beat `wins` levels - the best kept. */
export function addEndlessRun(progress: Progress, wins: number): Progress {
  return wins > progress.endlessBest
    ? { ...progress, endlessBest: wins }
    : progress;
}

/**
 * One more attempt at the daily level of `day`, with the streak - a count,
 * so it is added to the stored progress like the totals.
 */
export function addDailyAttempt(progress: Progress, day: string): Progress {
  return { ...progress, daily: addAttempt(progress.daily, day) };
}

/**
 * The progress with the best of either: the better medallion per level and
 * difficulty, the higher of each total and of each colour's wins, and the
 * earlier day of each achievement and training mission. Merging can only
 * gain, so progress from several tabs or devices converges whatever order
 * it is merged in. Without a gain it is the progress given.
 *
 * A total takes the higher of the two - a match's numbers are added to the
 * stored totals when it is written (ProgressService), so the higher one is
 * the one that counted more of the matches.
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
  const higher = TOTAL_KEYS.filter(
    (key) => other.totals[key] > merged.totals[key]
  );
  if (higher.length > 0) {
    const totals = { ...merged.totals };
    for (const key of higher) {
      totals[key] = other.totals[key];
    }
    merged = { ...merged, totals };
  }
  const achievements = earlierDays(merged.achievements, other.achievements);
  if (achievements !== null) {
    merged = { ...merged, achievements };
  }
  const moreWins = Object.entries(other.couchWins).filter(
    ([colorId, wins]) => (wins ?? 0) > (merged.couchWins[colorId] ?? 0)
  );
  if (moreWins.length > 0) {
    merged = {
      ...merged,
      couchWins: { ...merged.couchWins, ...Object.fromEntries(moreWins) },
    };
  }
  const training = earlierDays(merged.training, other.training);
  if (training !== null) {
    merged = { ...merged, training };
  }
  merged = addEndlessRun(merged, other.endlessBest);
  // The later day wins, and on the same day the more attempts.
  const daily = laterDaily(merged.daily, other.daily);
  if (daily !== merged.daily) {
    merged = { ...merged, daily };
  }
  return merged;
}

/**
 * An account's progress with what a guest played joined in, for a guest who
 * signs in to an account that has played elsewhere: the guest's counts - the
 * totals, each colour's wins - are added, and the rest merges. Applied once,
 * as the counts would count twice.
 */
export function adoptProgress(progress: Progress, guest: Progress): Progress {
  const counted = Object.entries(guest.couchWins).reduce(
    (sum, [colorId, wins]) => addCouchWin(sum, colorId, wins ?? 0),
    addTotals(progress, guest.totals)
  );
  return mergeProgress(counted, {
    ...guest,
    totals: NO_TOTALS,
    couchWins: {},
  });
}

/**
 * Days by id with the earlier day of either for each - an achievement
 * earned, a mission done - null when `other` has no earlier one.
 */
export function earlierDays<K extends string>(
  held: Partial<Record<K, string>>,
  other: Partial<Record<K, string>>
): Partial<Record<K, string>> | null {
  const earlier = (Object.entries(other) as [K, string][]).filter(
    ([id, day]) => {
      const kept = held[id];
      return kept == null || day < kept;
    }
  );
  return earlier.length === 0
    ? null
    : { ...held, ...Object.fromEntries(earlier) };
}

/** Of two daily records the later one, or the one with more attempts. */
function laterDaily(
  held: DailyRecord | null,
  other: DailyRecord | null
): DailyRecord | null {
  if (other === null || held === null) {
    return held ?? other;
  }
  if (other.day !== held.day) {
    return other.day > held.day ? other : held;
  }
  return other.attempts > held.attempts ? other : held;
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
    achievements: parseDays(value['achievements'], isAchievementId),
    couchWins: parseCouchWins(value['couchWins']),
    daily: parseDaily(value['daily']),
    endlessBest: isInteger(value['endlessBest'], 1) ? value['endlessBest'] : 0,
    training: parseDays(value['training'], isMissionId),
  };
}

/** The daily record, null for anything else. */
function parseDaily(value: unknown): DailyRecord | null {
  if (!isObject(value)) {
    return null;
  }
  const { day, attempts, streak } = value;
  return typeof day === 'string' &&
    ISO_DATE.test(day) &&
    isInteger(attempts, 1) &&
    isInteger(streak, 1)
    ? { day, attempts, streak }
    : null;
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

function parseCouchWins(value: unknown): Progress['couchWins'] {
  const wins: Progress['couchWins'] = {};
  if (!isObject(value)) {
    return wins;
  }
  for (const [colorId, count] of Object.entries(value)) {
    if (
      isColonyColor(colorId) &&
      typeof count === 'number' &&
      Number.isFinite(count) &&
      count > 0
    ) {
      wins[colorId] = Math.floor(count);
    }
  }
  return wins;
}

/** A day as an achievement stores it, "2026-10-19". */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Days by id - an achievement's, a mission's - keeping the ids `isId` knows. */
function parseDays<K extends string>(
  value: unknown,
  isId: (id: string) => id is K
): Partial<Record<K, string>> {
  const days: Partial<Record<K, string>> = {};
  if (!isObject(value)) {
    return days;
  }
  for (const [id, date] of Object.entries(value)) {
    if (isId(id) && typeof date === 'string' && ISO_DATE.test(date)) {
      days[id] = date;
    }
  }
  return days;
}
