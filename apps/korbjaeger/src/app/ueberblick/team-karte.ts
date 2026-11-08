import {
  saisonBeendet,
  teamUeberblick,
  type Spiel,
  type TeamId,
  type TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { fehlerText, KEIN_TEAM } from '../fehler/fehler-text';
import type { HallenStand } from '../halle/hallen-stand';
import { spielZeile, type SpielZeile } from '../spiel/spiel-zeile';
import type { VereinsTeamsStand } from '../verein/vereins-teams-stand';

/** One of Meine Teams on the overview, as its card shows it. */
export type TeamKarte =
  | { readonly art: 'laedt'; readonly teamId: TeamId }
  | { readonly art: 'fehler'; readonly teamId: TeamId; readonly text: string }
  | {
      readonly art: 'geladen';
      readonly teamId: TeamId;
      readonly name: string;
      /** The next Spiel, by which the overview orders the cards. */
      readonly naechstesSpiel?: Spiel;
      readonly naechstes?: SpielZeile;
      /** The read of the next Spiel's Halle, once it started. */
      readonly halle?: HallenStand;
      readonly ausfaelle: readonly SpielZeile[];
      readonly letztes?: SpielZeile;
      /** Whether the Team's Saison is over (`saisonBeendet`). */
      readonly saisonBeendet: boolean;
      /** The read of the Verein's other Teams, once it started. */
      readonly vereinsTeams?: VereinsTeamsStand;
    };

/**
 * The card of a Team whose Saison was read, on `heute`, with the reads of
 * its next Spiel's Halle and of its Verein's other Teams where they
 * started.
 */
export function geladeneKarte(
  saison: TeamSaison,
  heute: string,
  halle?: HallenStand,
  vereinsTeams?: VereinsTeamsStand
): TeamKarte {
  const { naechstes, ausfaelle, letztes } = teamUeberblick(saison, heute);
  return {
    art: 'geladen',
    teamId: saison.team.id,
    name: saison.team.name,
    naechstesSpiel: naechstes,
    naechstes: naechstes && spielZeile(saison, naechstes),
    ...(halle && { halle }),
    ausfaelle: ausfaelle.map((spiel) => spielZeile(saison, spiel)),
    letztes: letztes && spielZeile(saison, letztes),
    saisonBeendet: saisonBeendet(saison, heute),
    ...(vereinsTeams && { vereinsTeams }),
  };
}

/** The card of a Team whose read failed with `fehler`. */
export function fehlerKarte(teamId: TeamId, fehler: unknown): TeamKarte {
  // a read rejected without a reason failed all the same
  const text = fehlerText(fehler ?? new Error('rejected'), KEIN_TEAM) ?? '';
  return { art: 'fehler', teamId, text };
}
