import type {
  Tabelle,
  TabellenZeile,
  TeamId,
} from '@wolsok/feat-shared-basketball-data';

/** One line of a Liga's Tabelle, as the Team page shows it. */
export interface TabelleZeile {
  readonly rang: number;
  readonly teamId: TeamId;
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
  tabelle: Tabelle,
  teamId: TeamId
): readonly TabelleZeile[] {
  return tabelle.zeilen.map((zeile) => tabelleZeile(zeile, teamId));
}

function tabelleZeile(zeile: TabellenZeile, teamId: TeamId): TabelleZeile {
  return {
    rang: zeile.rang,
    teamId: zeile.team.id,
    team: zeile.team.name,
    spiele: zeile.spiele,
    siege: zeile.siege,
    niederlagen: zeile.niederlagen,
    koerbe: `${zeile.koerbe}:${zeile.gegenkoerbe}`,
    differenz: vorzeichen(zeile.korbdifferenz),
    eigenes: zeile.team.id === teamId,
  };
}

/** `+12`, `0` or `−12`, with a real minus sign. */
function vorzeichen(differenz: number): string {
  if (differenz > 0) {
    return `+${differenz}`;
  }
  return differenz < 0 ? `−${-differenz}` : '0';
}
