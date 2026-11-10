import type { PersonId, GameId } from './ids';

/** One player's numbers in one Spiel. */
export interface PlayerStats {
  readonly points: number;
  /** Two-point field goals made. */
  readonly twoPointers: number;
  /** Three-point field goals made. */
  readonly threePointers: number;
  readonly freeThrows: {
    readonly made: number;
    readonly attempted: number;
  };
  readonly fouls: number;
}

/** A player on a Kader with a name: the only kind that can become a Kind. */
export interface NamedPlayer {
  readonly kind: 'named';
  readonly personId: PersonId;
  readonly firstName: string;
  readonly lastName: string;
  /** Absent where the Spielbericht has none. */
  readonly shirtNumber?: string;
  /** Absent where the Verband records no Spielerwerte. */
  readonly playerStats?: PlayerStats;
}

/**
 * A player whose name the DBB hides because the family objected. Without
 * a person id, it cannot be told apart from another or marked as a Kind.
 */
export interface AnonymousPlayer {
  readonly kind: 'anonymous';
  /** Absent where the Verband records no Spielerwerte. */
  readonly playerStats?: PlayerStats;
}

/** One line of a Kader. */
export type RosterEntry = NamedPlayer | AnonymousPlayer;

/** The players listed on a Spielbericht for one Team. */
export interface Roster {
  /**
   * Whether this Kader's Spielerwerte were recorded. A Kader whose numbers
   * are all 0 means they were not, never that nobody scored; its entries
   * then carry none. Decided per Kader, since one side's can be filled in
   * and the other's not.
   */
  readonly playerStatsRecorded: boolean;
  readonly entries: readonly RosterEntry[];
}

/** What the DBB records about a played Spiel. */
export interface GameReport {
  readonly gameId: GameId;
  readonly home: Roster;
  readonly away: Roster;
}

/** Whether either Kader of a Spielbericht has Spielerwerte. */
export function playerStatsRecorded(report: GameReport): boolean {
  return report.home.playerStatsRecorded || report.away.playerStatsRecorded;
}

/**
 * A player's field goals (Feldkörbe): the twos and threes made. Only the
 * hits: the Spielberichte seen list no attempts for them (all 0).
 */
export function fieldGoals(stats: PlayerStats): number {
  return stats.twoPointers + stats.threePointers;
}

/** Whether a Kader entry is a named player, so it can be marked as a Kind. */
export function isNamed(entry: RosterEntry): entry is NamedPlayer {
  return entry.kind === 'named';
}
