import { generatedLevelId } from './level-generator/generate-level';
import { RECIPE_IDS } from './level-generator/recipes';

/** Attempts a day that count towards the daily level's medallion. */
export const DAILY_ATTEMPTS = 3;

/** Days in a row of playing the daily level - one missed day only pauses it. */
export interface Streak {
  days: number;
  /** The last day the daily level was played, as an ISO date. */
  lastDay: string;
}

/** The daily attempts of one day. */
export interface DailyAttempts {
  day: string;
  attempts: number;
}

/** The day of a moment, in UTC - the same day for everyone, "2026-10-20". */
export function utcDay(moment: Date): string {
  return moment.toISOString().slice(0, 10);
}

/** Whole days from one ISO date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/** The generated level everybody plays on that day. */
export function dailyLevelId(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  // The style changes from day to day; the week warms up to its weekend.
  const dayNumber = Math.floor(date.getTime() / 86_400_000);
  return generatedLevelId({
    recipe: RECIPE_IDS[dayNumber % RECIPE_IDS.length],
    seed: Number(day.replaceAll('-', '')),
    difficulty: WEEKDAY_DIFFICULTY[date.getUTCDay()],
  });
}

/** How hard the daily level is, Sunday first. */
const WEEKDAY_DIFFICULTY = [6, 3, 4, 5, 5, 6, 7] as const;

/**
 * The streak after playing the daily level on `day`: one more day when the
 * last one was yesterday - or the day before, a missed day pauses it rather
 * than ending it - the same on a day already counted, and a new one after
 * a longer break.
 */
export function nextStreak(streak: Streak | null, day: string): Streak {
  if (streak === null) {
    return { days: 1, lastDay: day };
  }
  const gap = daysBetween(streak.lastDay, day);
  if (gap <= 0) {
    return streak;
  }
  return { days: gap <= 2 ? streak.days + 1 : 1, lastDay: day };
}

/**
 * The streak as it stands on `day`: kept while the last day played is at
 * most two days back, else gone.
 */
export function standingStreak(streak: Streak | null, day: string): number {
  return streak !== null && daysBetween(streak.lastDay, day) <= 2
    ? streak.days
    : 0;
}
