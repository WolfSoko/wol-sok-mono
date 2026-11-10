import {
  isTeam,
  participantName,
  type Standings,
  type StandingsRow,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';

/** One line of a Liga's Tabelle, as the Team page shows it. */
export interface TabelleZeileAnsicht {
  readonly rang: number;
  /** The Team's name, or the slot's ("Nord 1. Platz"). */
  readonly team: string;
  readonly spiele: number;
  readonly siege: number;
  readonly niederlagen: number;
  /** Points for and against, `470:204`. */
  readonly koerbe: string;
  /** The difference, signed: `+266`, `0`, `−73`. */
  readonly differenz: string;
  /** Whether this is the line of the Team whose page it is. */
  readonly eigenes: boolean;
}

/** The lines of `tabelle`, the one of Team `teamId` marked as its own. */
export function tabelleZeilen(
  tabelle: Standings,
  teamId: TeamId
): readonly TabelleZeileAnsicht[] {
  return tabelle.rows.map((zeile) => tabelleZeile(zeile, teamId));
}

function tabelleZeile(
  zeile: StandingsRow,
  teamId: TeamId
): TabelleZeileAnsicht {
  return {
    rang: zeile.rank,
    team: participantName(zeile.participant),
    spiele: zeile.games,
    siege: zeile.wins,
    niederlagen: zeile.losses,
    koerbe: `${zeile.pointsFor}:${zeile.pointsAgainst}`,
    differenz: vorzeichen(zeile.pointDifference),
    eigenes: isTeam(zeile.participant, teamId),
  };
}

/** `+12`, `0` or `−12`, with a real minus sign. */
function vorzeichen(differenz: number): string {
  if (differenz > 0) {
    return `+${differenz}`;
  }
  return differenz < 0 ? `−${-differenz}` : '0';
}
