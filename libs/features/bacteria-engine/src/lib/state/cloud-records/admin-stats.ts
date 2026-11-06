/**
 * The admin overview's single figures (ADR 0012), as `adminStats/now` and
 * its hourly snapshots store them: counters and `count()`s.
 */
export const ADMIN_STATS_FIGURES = [
  'accounts',
  'active24h',
  'active7d',
  'online',
  'playing',
  'searching',
  'roomsOpen',
  'matchesRunning',
  'replays',
  'replaysToday',
  'submissionsWaiting',
  'bans',
  'uploadedPictures',
] as const;

export type AdminStatsFigure = (typeof ADMIN_STATS_FIGURES)[number];

/** The overview's statistics as the functions compute them. */
export type AdminStats = Record<AdminStatsFigure, number> & {
  /** Entries per board: `xp`, `online`, `endless` and today's daily one. */
  entries: Record<string, number>;
  /** Today's counters (`counters/{day}`), verification minutes included. */
  today: Record<string, number>;
};
