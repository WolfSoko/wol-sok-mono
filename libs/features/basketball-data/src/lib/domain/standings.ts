import type { League } from './league';
import type { Participant } from './participant';

/** One Team's line in a Liga's Tabelle. */
export interface StandingsRow {
  readonly rank: number;
  /**
   * The Team, or the slot a Hauptrunde keeps for a Team its Vorrunden have
   * yet to settle ("Nord 1. Platz"), as on either side of a Spiel.
   */
  readonly participant: Participant;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  readonly points: number;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly pointDifference: number;
}

/** A Liga's standings; empty while the Liga keeps none yet. */
export interface Standings {
  readonly league: League;
  readonly rows: readonly StandingsRow[];
}
