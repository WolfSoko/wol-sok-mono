import {
  ADMIN_STATS_FIGURES,
  type AdminStatsFigure,
  type AdminStats as ComputedStats,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { counts } from '../moderation/admin-records';

/**
 * `adminStats/now` and the hourly snapshots, as the overview reads them:
 * the functions' statistics and when they were computed (ms, null when
 * not readable).
 */
export type AdminStats = ComputedStats & { at: number | null };

/** The single figures, in the order the overview shows them, by group. */
export const FIGURE_GROUPS = {
  players: ['accounts', 'active24h', 'active7d', 'online', 'playing'],
  matches: ['searching', 'roomsOpen', 'matchesRunning'],
  replays: ['replays', 'replaysToday', 'submissionsWaiting'],
  moderation: ['bans', 'uploadedPictures'],
} as const satisfies Record<string, readonly AdminStatsFigure[]>;

export type Figure = (typeof FIGURE_GROUPS)[keyof typeof FIGURE_GROUPS][number];

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * Reads a stored statistics document, keeping what it can: a figure that
 * is missing or not a number reads 0, so an older document still shows.
 */
export function parseAdminStats(
  data: Record<string, unknown> | undefined
): AdminStats | null {
  if (data === undefined) {
    return null;
  }
  const at = data['at'] as { toMillis?: () => number } | null | undefined;
  const figures = Object.fromEntries(
    ADMIN_STATS_FIGURES.map((figure) => [figure, count(data[figure])])
  ) as Record<AdminStatsFigure, number>;
  return {
    ...figures,
    entries: counts(data['entries']),
    today: counts(data['today']),
    at: typeof at?.toMillis === 'function' ? at.toMillis() : null,
  };
}

/** The hour a snapshot id `h_yyyymmddhh` is of, ms since the epoch. */
export function snapshotHour(id: string): number | null {
  const match = /^h_(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(id);
  if (match === null) {
    return null;
  }
  const [, y, m, d, h] = match.map(Number);
  return Date.UTC(y, m - 1, d, h);
}
