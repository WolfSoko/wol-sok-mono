import {
  fieldGoals,
  recordedStats,
  type PlayerStats,
  type Roster,
  type RosterEntry,
  type Shots,
} from '@wolsok/feat-shared-basketball-data';
import { SECONDS_IN_MINUTE } from '@wolsok/utils-time';
import type { Child, MarkablePlayer } from '@wolsok/feat-korbjaeger-selection';

/**
 * What the Kader table shows of a player's Spielerwerte, one field a
 * column (`StatsColumnId`); which of them show, `statsColumns` decides.
 */
export interface PlayerStatsRow {
  /** Minutes and seconds, e.g. `28:44`. */
  readonly playingTime: string;
  readonly points: number;
  /** The hits, or made of attempted (`8/14`) where attempts are recorded. */
  readonly fieldGoals: string;
  /** As `fieldGoals`. */
  readonly threePointers: string;
  /** Made of attempted, e.g. `2/7`. */
  readonly freeThrows: string;
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
  readonly turnovers: number;
  readonly blocks: number;
  readonly fouls: number;
  readonly efficiency: number;
}

/** One player of a Kader, as the Spiel page lists them. */
export interface RosterRow {
  /** Absent where the Spielbericht has none, and for an Anonymer Spieler. */
  readonly number?: string;
  /** The name as the DBB shows it, or "Anonymer Spieler". */
  readonly name: string;
  readonly anonymous: boolean;
  /** Absent where the Verband records no Spielerwerte. */
  readonly stats?: PlayerStatsRow;
  /** Whether the player was in the starting five, where the DBB says so. */
  readonly starter: boolean;
  /**
   * The player to mark as a Kind: a named one of a followed Team's Kader
   * only (ADR 0019).
   */
  readonly player?: MarkablePlayer;
  /** The player as a marked Kind, shown highlighted; only where `player` is. */
  readonly child?: Child;
}

/** What the page calls a player the DBB hides (ADR 0019). */
export const ANONYMOUS_PLAYER = 'Anonymer Spieler';

/**
 * The lines of `roster`, in the Spielbericht's order. Where the Kader is a
 * followed Team's, `children` are the marked Kinder: its named players can
 * be marked, and those marked are highlighted. Without `children` (another
 * Team's Kader) nobody is.
 */
export function rosterRows(
  roster: Roster,
  children?: readonly Child[]
): readonly RosterRow[] {
  const { shotAttempts } = recordedStats(roster);
  return roster.entries.map((entry) => {
    const row = rosterRow(entry, shotAttempts);
    if (children === undefined || entry.kind === 'anonymous') {
      return row;
    }
    const { personId } = entry;
    const kind = children.find((marked) => marked.personId === personId);
    return {
      ...row,
      player: { kind: 'named', personId },
      ...(kind && { child: kind }),
    };
  });
}

function rosterRow(entry: RosterEntry, shotAttempts: boolean): RosterRow {
  const stats = entry.playerStats;
  const withStats = {
    ...(stats && { stats: statsRow(stats, shotAttempts) }),
    starter: stats?.startingFive ?? false,
  };
  if (entry.kind === 'anonymous') {
    return { name: ANONYMOUS_PLAYER, anonymous: true, ...withStats };
  }
  return {
    ...(entry.shirtNumber === undefined ? {} : { number: entry.shirtNumber }),
    name: `${entry.firstName} ${entry.lastName}`,
    anonymous: false,
    ...withStats,
  };
}

function statsRow(stats: PlayerStats, shotAttempts: boolean): PlayerStatsRow {
  const shots = (taken: Shots): string =>
    shotAttempts ? madeOfAttempted(taken) : `${taken.made}`;
  return {
    playingTime: playingTime(stats.playingTimeSeconds),
    points: stats.points,
    fieldGoals: shots(fieldGoals(stats)),
    threePointers: shots(stats.threePointers),
    freeThrows: madeOfAttempted(stats.freeThrows),
    rebounds: stats.rebounds,
    assists: stats.assists,
    steals: stats.steals,
    turnovers: stats.turnovers,
    blocks: stats.blocks,
    fouls: stats.fouls,
    efficiency: stats.efficiency,
  };
}

function madeOfAttempted({ made, attempted }: Shots): string {
  return `${made}/${attempted}`;
}

/** A playing time as minutes and seconds: 1724 → `28:44`. */
export function playingTime(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / SECONDS_IN_MINUTE);
  const rest = whole % SECONDS_IN_MINUTE;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
