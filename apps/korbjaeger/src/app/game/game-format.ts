import type { Score } from '@wolsok/feat-shared-basketball-data';

const TAG = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A Spiel's `date` (`YYYY-MM-DD`) as the screens show it: `Sa., 29.08.2026`. */
export function gameDay(date: string): string {
  return TAG.format(new Date(`${date}T00:00:00Z`));
}

/** The day and, where the DBB has one, the tip-off: `So., 20.09.2026 · 09:00 Uhr`. */
export function gameDayAndTime(date: string, time?: string): string {
  const tag = gameDay(date);
  return time === undefined ? tag : `${tag} · ${time} Uhr`;
}

/** A Spiel's points, home first: `78:47`. */
export function resultText(score: Score): string {
  return `${score.home}:${score.away}`;
}

/**
 * The word beside a score a correction may still change
 * (`resultProvisional`), the same on every screen.
 */
export const PROVISIONAL = 'vorläufig';
