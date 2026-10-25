import { counts } from '../moderation/admin-records';

/** `adminStats/now` and the hourly snapshots, as the overview reads them. */
export interface AdminStats {
  accounts: number;
  active24h: number;
  active7d: number;
  online: number;
  playing: number;
  searching: number;
  roomsOpen: number;
  matchesRunning: number;
  replays: number;
  replaysToday: number;
  submissionsWaiting: number;
  bans: number;
  uploadedPictures: number;
  entries: Record<string, number>;
  today: Record<string, number>;
  /** When it was computed, ms since the epoch. */
  at: number | null;
}

/** The single figures, in the order the overview shows them, by group. */
export const FIGURE_GROUPS = {
  players: ['accounts', 'active24h', 'active7d', 'online', 'playing'],
  matches: ['searching', 'roomsOpen', 'matchesRunning'],
  replays: ['replays', 'replaysToday', 'submissionsWaiting'],
  moderation: ['bans', 'uploadedPictures'],
} as const satisfies Record<string, readonly (keyof AdminStats)[]>;

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
  return {
    accounts: count(data['accounts']),
    active24h: count(data['active24h']),
    active7d: count(data['active7d']),
    online: count(data['online']),
    playing: count(data['playing']),
    searching: count(data['searching']),
    roomsOpen: count(data['roomsOpen']),
    matchesRunning: count(data['matchesRunning']),
    replays: count(data['replays']),
    replaysToday: count(data['replaysToday']),
    submissionsWaiting: count(data['submissionsWaiting']),
    bans: count(data['bans']),
    uploadedPictures: count(data['uploadedPictures']),
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
