import {
  isTeam,
  participantName,
  type Standings,
  type StandingsRow,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';

/** One line of a Liga's Tabelle, as the Team page shows it. */
export interface StandingsRowView {
  readonly rank: number;
  /** The Team's name, or the slot's ("Nord 1. Platz"). */
  readonly team: string;
  readonly games: number;
  readonly wins: number;
  readonly losses: number;
  /** Points for and against, `470:204`. */
  readonly points: string;
  /** The difference, signed: `+266`, `0`, `−73`. */
  readonly difference: string;
  /** Whether this is the line of the Team whose page it is. */
  readonly own: boolean;
}

/** The lines of `standings`, the one of Team `teamId` marked as its own. */
export function standingsRows(
  standings: Standings,
  teamId: TeamId
): readonly StandingsRowView[] {
  return standings.rows.map((row) => standingsRow(row, teamId));
}

function standingsRow(row: StandingsRow, teamId: TeamId): StandingsRowView {
  return {
    rank: row.rank,
    team: participantName(row.participant),
    games: row.games,
    wins: row.wins,
    losses: row.losses,
    points: `${row.pointsFor}:${row.pointsAgainst}`,
    difference: signed(row.pointDifference),
    own: isTeam(row.participant, teamId),
  };
}

/** `+12`, `0` or `−12`, with a real minus sign. */
function signed(difference: number): string {
  if (difference > 0) {
    return `+${difference}`;
  }
  return difference < 0 ? `−${-difference}` : '0';
}
