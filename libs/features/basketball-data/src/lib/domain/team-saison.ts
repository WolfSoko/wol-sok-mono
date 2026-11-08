import type { LigaId } from './ids';
import type { Liga } from './liga';
import type { Spiel } from './spiel';
import type { Team } from './team';
import type { Verein } from './verein';

/**
 * A Team's whole Saison: every Spiel in every Liga it plays in (a Vorrunde,
 * then a Hauptrunde), in one list by date.
 */
export interface TeamSaison {
  readonly team: Team;
  readonly verein: Verein;
  /** The Ligen of `spiele`, in the order they first play. */
  readonly ligen: readonly Liga[];
  readonly spiele: readonly Spiel[];
}

/** A Team seen in a Verein's recent Spiele, with the Ligen it played in. */
export interface VereinsTeam {
  readonly team: Team;
  readonly ligen: readonly Liga[];
}

/** A Verein with the Teams seen in its recent Spiele, by name. */
export interface VereinsTeams {
  readonly verein: Verein;
  readonly teams: readonly VereinsTeam[];
}

/** The Liga `ligaId` of `saison`, if the Team plays in it. */
export function ligaVon(saison: TeamSaison, ligaId: LigaId): Liga | undefined {
  return saison.ligen.find(({ id }) => id === ligaId);
}

/**
 * The Team's next Spiel from `heute` on (today's included), passing over
 * cancelled (`abgesagt`) ones, which will not be played that day; a
 * forfeited (`kampflos`) one counts, since its result counts in its Liga's
 * Tabelle. Relies on the date order of `saison.spiele`.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`datumInDeutschland`)
 */
export function naechstesSpiel(
  saison: TeamSaison,
  heute: string
): Spiel | undefined {
  return stattfindende(saison).find(({ datum }) => datum >= heute);
}

/**
 * The Ligen of `saison`, the current one first: the Liga of the next Spiel
 * (`naechstesSpiel`), or of the last Spiel not cancelled once none is left
 * (of the last Spiel where all are). A Hauptrunde takes over with its first
 * Spiel to come; a Vorrunde with a Spiel still ahead stays first. The
 * other Ligen follow by their last Spiel, newest first.
 */
export function ligenAktuellZuerst(
  saison: TeamSaison,
  heute: string
): readonly Liga[] {
  const aktuell =
    naechstesSpiel(saison, heute) ??
    stattfindende(saison).at(-1) ??
    saison.spiele.at(-1);
  if (aktuell === undefined) {
    return [];
  }
  const neuesteZuerst = [...saison.spiele]
    .reverse()
    .map(({ ligaId }) => ligaId);
  return [...new Set<LigaId>([aktuell.ligaId, ...neuesteZuerst])]
    .map((id) => ligaVon(saison, id))
    .filter((liga): liga is Liga => liga !== undefined);
}

function stattfindende(saison: TeamSaison): readonly Spiel[] {
  return saison.spiele.filter(({ status }) => status.art !== 'abgesagt');
}
