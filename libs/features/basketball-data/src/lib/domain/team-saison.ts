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
 * The Team's next Spiel to go to, from `heute` on (today's included): the
 * first still to be played (`geplant`). It passes over a cancelled
 * (`abgesagt`) Spiel, one played already (`gespielt`, today's too once its
 * result is in) and a forfeited (`kampflos`) one, with or without a
 * result, since none of them is played. Relies on the date order of
 * `saison.spiele`.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`datumInDeutschland`)
 */
export function naechstesSpiel(
  saison: TeamSaison,
  heute: string
): Spiel | undefined {
  return saison.spiele[naechstesSpielIndex(saison, heute)];
}

/** Where `naechstesSpiel` stands in `saison.spiele`; -1 where none is left. */
export function naechstesSpielIndex(saison: TeamSaison, heute: string): number {
  return saison.spiele.findIndex(
    ({ datum, status }) => datum >= heute && status.art === 'geplant'
  );
}

/**
 * The Spiele of `saison` played up to `heute` (today's included), newest
 * first, at most `hoechstens`: those with a Spielbericht to look into.
 * Cancelled and forfeited Spiele have none; a result the DBB lists ahead of
 * its day is passed over, as `teamUeberblick` does. Relies on the date
 * order of `saison.spiele`.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`datumInDeutschland`)
 */
export function zuletztGespielt(
  saison: TeamSaison,
  heute: string,
  hoechstens: number
): readonly Spiel[] {
  return saison.spiele
    .filter(({ datum, status }) => datum <= heute && status.art === 'gespielt')
    .reverse()
    .slice(0, hoechstens);
}

/** How many days after its last Spiel a Team's Saison counts as over. */
const SAISON_ENDE_NACH_TAGEN = 14;

/**
 * Whether the Team's Saison looks over on `heute`: no Spiel left to go to
 * (`naechstesSpiel`) and its last Spiel more than two weeks
 * (`SAISON_ENDE_NACH_TAGEN`) past. A long break looks the same (between a
 * Vorrunde and a Hauptrunde not yet scheduled, over the holidays), so a
 * screen asks rather than claims. Relies on the date order of
 * `saison.spiele`.
 *
 * @param heute a German calendar day, `YYYY-MM-DD` (`datumInDeutschland`)
 */
export function saisonBeendet(saison: TeamSaison, heute: string): boolean {
  const letztes = saison.spiele.at(-1);
  return (
    letztes !== undefined &&
    naechstesSpielIndex(saison, heute) === -1 &&
    tageZwischen(letztes.datum, heute) > SAISON_ENDE_NACH_TAGEN
  );
}

const MS_PRO_TAG = 24 * 60 * 60 * 1000;

/** The calendar days from `von` to `bis`, both `YYYY-MM-DD`. */
function tageZwischen(von: string, bis: string): number {
  return (Date.parse(bis) - Date.parse(von)) / MS_PRO_TAG;
}

/**
 * The Ligen of `saison`, the current one first: the Liga of the first Spiel
 * not cancelled from `heute` on, played or forfeited ones included, since
 * their results count in the Liga's Tabelle (so on match day the Liga of
 * today's Spiel stays first once it is played); or of the last Spiel not
 * cancelled once none is left (of the last Spiel where all are). A
 * Hauptrunde takes over with its first Spiel to come; a Vorrunde with a
 * Spiel still ahead stays first. The other Ligen follow by their last
 * Spiel, newest first.
 */
export function ligenAktuellZuerst(
  saison: TeamSaison,
  heute: string
): readonly Liga[] {
  const aktuell = aktuellesSpiel(saison, heute);
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

/**
 * The Spiel whose Liga is the current one (`ligenAktuellZuerst`): the
 * first not cancelled from `heute` on, else the last not cancelled, else
 * the last of all.
 */
function aktuellesSpiel(saison: TeamSaison, heute: string): Spiel | undefined {
  const stattfindend = stattfindende(saison);
  return (
    stattfindend.find(({ datum }) => datum >= heute) ??
    stattfindend.at(-1) ??
    saison.spiele.at(-1)
  );
}

function stattfindende(saison: TeamSaison): readonly Spiel[] {
  return saison.spiele.filter(({ status }) => status.art !== 'abgesagt');
}
