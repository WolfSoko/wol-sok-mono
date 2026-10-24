export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** The UTC day of a moment, "2026-10-24" - the game's day (`utcDay`). */
export function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The UTC hour of a moment, "2026-10-24T13". */
export function hourOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 13);
}

/** The first moment of a UTC day, in ms since the epoch. */
export function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}
