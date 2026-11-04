import {
  generatedLevelId,
  parseGeneratedId,
} from './level-generator/generate-level';
import { RECIPE_IDS } from './level-generator/recipes';

/** Attempts a day that count towards the daily level's medallion. */
export const DAILY_ATTEMPTS = 3;

/**
 * The daily level as the progress keeps it: the last day it was played, the
 * attempts of that day, and the days in a row up to it.
 */
export interface DailyRecord {
  day: string;
  attempts: number;
  /** Days in a row of playing it - one missed day only pauses the count. */
  streak: number;
}

/** Days that may pass between two days played before the streak ends. */
const STREAK_GRACE_DAYS = 2;

/** How hard the daily level is, Sunday first. */
const WEEKDAY_DIFFICULTY = [6, 3, 4, 5, 5, 6, 7] as const;

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
  const dayNumber = daysBetween('1970-01-01', day);
  // The style changes from day to day; the week warms up to its weekend -
  // 1 January 1970 was a Thursday.
  return generatedLevelId({
    recipe: RECIPE_IDS[dayNumber % RECIPE_IDS.length],
    seed: Number(day.replaceAll('-', '')),
    difficulty: WEEKDAY_DIFFICULTY[(dayNumber + 4) % 7],
  });
}

/**
 * True for the daily level of some day - a generated level whose seed is
 * that day, made by that day's recipe and difficulty. The id alone tells,
 * without knowing which day it is now.
 */
export function isDailyLevelId(id: string): boolean {
  const seed = parseGeneratedId(id)?.seed;
  const digits =
    seed === undefined ? null : /^(\d{4})(\d{2})(\d{2})$/.exec(`${seed}`);
  if (digits === null) {
    return false;
  }
  const day = `${digits[1]}-${digits[2]}-${digits[3]}`;
  const moment = Date.parse(day);
  return (
    Number.isFinite(moment) &&
    utcDay(new Date(moment)) === day &&
    dailyLevelId(day) === id
  );
}

/**
 * The daily record after one more attempt on `day`: one more attempt of
 * that day, and the streak one day longer when the last day played was
 * yesterday - or the day before, a missed day pauses it rather than ending
 * it - the same on a day already counted, new after a longer break.
 */
export function addAttempt(
  record: DailyRecord | null,
  day: string
): DailyRecord {
  if (record === null) {
    return { day, attempts: 1, streak: 1 };
  }
  const gap = daysBetween(record.day, day);
  if (gap <= 0) {
    return { ...record, attempts: record.attempts + 1 };
  }
  return {
    day,
    attempts: 1,
    streak: gap <= STREAK_GRACE_DAYS ? record.streak + 1 : 1,
  };
}

/** The attempts made on `day` so far. */
export function attemptsOn(record: DailyRecord | null, day: string): number {
  return record?.day === day ? record.attempts : 0;
}

/**
 * The streak as it stands on `day`: kept while the last day played is at
 * most two days back, else gone.
 */
export function standingStreak(
  record: DailyRecord | null,
  day: string
): number {
  return record !== null && daysBetween(record.day, day) <= STREAK_GRACE_DAYS
    ? record.streak
    : 0;
}
