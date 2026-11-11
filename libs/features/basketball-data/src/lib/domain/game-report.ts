import type { PersonId, GameId } from './ids';

/** Shots of one kind: those made, of those attempted. */
export interface Shots {
  readonly made: number;
  /** 0 where the Verband records only the hits. */
  readonly attempted: number;
}

/**
 * One player's numbers in one Spiel. A value the Verband does not record
 * is 0: which ones a Kader records, `recordedStats` says.
 */
export interface PlayerStats {
  /** Time on the court, in seconds. */
  readonly playingTimeSeconds: number;
  readonly points: number;
  /** Two-point field goals. */
  readonly twoPointers: Shots;
  /** Three-point field goals. */
  readonly threePointers: Shots;
  readonly freeThrows: Shots;
  /** Offensive and defensive rebounds together. */
  readonly rebounds: number;
  readonly assists: number;
  readonly steals: number;
  readonly turnovers: number;
  readonly blocks: number;
  readonly fouls: number;
  /**
   * The DBB's efficiency: points, rebounds, assists, steals and blocks,
   * less missed shots and turnovers. Meaningless where shot attempts are
   * not recorded, since the DBB then counts every hit as a negative miss.
   */
  readonly efficiency: number;
  /** Whether the player was in the starting five. */
  readonly startingFive: boolean;
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

/** A player's field goals (Feldkörbe): the twos and threes, no free throws. */
export function fieldGoals(stats: PlayerStats): Shots {
  return {
    made: stats.twoPointers.made + stats.threePointers.made,
    attempted: stats.twoPointers.attempted + stats.threePointers.attempted,
  };
}

/** Whether a Kader entry is a named player, so it can be marked as a Kind. */
export function isNamed(entry: RosterEntry): entry is NamedPlayer {
  return entry.kind === 'named';
}
