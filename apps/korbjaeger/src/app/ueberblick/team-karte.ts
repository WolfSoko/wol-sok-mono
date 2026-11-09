import type {
  Spiel,
  TeamId,
  TeamSaison,
  TeamUeberblick,
  Verein,
} from '@wolsok/feat-shared-basketball-data';
import { fehlerText, KEIN_TEAM } from '../fehler/fehler-text';
import type { Stand } from '../basketball-data/stand';
import type { HallenStand } from '../halle/hallen-stand';
import { spielZeile, type SpielZeile } from '../spiel/spiel-zeile';
import type { VereinsTeamsStand } from '../verein/vereins-teams-stand';

/** What a card shows beside a Team's Saison, from the overview's reads. */
export interface KartenZusatz {
  /** Where the Saison is its last good data: since when, and why. */
  readonly stand?: Stand;
  /** The read of the next Spiel's Halle, once it started. */
  readonly halle?: HallenStand;
  /** Whether the Team's Saison looks over (`saisonBeendet`). */
  readonly saisonBeendet: boolean;
  /** The read of the Verein's Teams to suggest, once it started. */
  readonly vereinsTeams?: VereinsTeamsStand;
}

/** One of Meine Teams on the overview, as its card shows it. */
export type TeamKarte =
  | { readonly art: 'laedt'; readonly teamId: TeamId }
  | { readonly art: 'fehler'; readonly teamId: TeamId; readonly text: string }
  | ({
      readonly art: 'geladen';
      readonly teamId: TeamId;
      readonly name: string;
      /** The Team's Verein, whose colours the card wears. */
      readonly verein: Verein;
      /** The next Spiel, by which the overview orders the cards. */
      readonly naechstesSpiel?: Spiel;
      readonly naechstes?: SpielZeile;
      readonly ausfaelle: readonly SpielZeile[];
      readonly letztes?: SpielZeile;
    } & KartenZusatz);

/** The Team's name on a card, or its id while no read has given a name. */
export function kartenName(karte: TeamKarte): string {
  return karte.art === 'geladen' ? karte.name : `Team ${karte.teamId}`;
}

/**
 * The card of a Team whose Saison was read, from its overview
 * (`teamUeberblick`), with `zusatz`.
 */
export function geladeneKarte(
  saison: TeamSaison,
  { naechstes, ausfaelle, letztes }: TeamUeberblick,
  zusatz: KartenZusatz
): TeamKarte {
  return {
    art: 'geladen',
    teamId: saison.team.id,
    name: saison.team.name,
    verein: saison.verein,
    naechstesSpiel: naechstes,
    naechstes: naechstes && spielZeile(saison, naechstes),
    ausfaelle: ausfaelle.map((spiel) => spielZeile(saison, spiel)),
    letztes: letztes && spielZeile(saison, letztes),
    ...zusatz,
  };
}

/** The card of a Team whose read failed with `fehler`. */
export function fehlerKarte(teamId: TeamId, fehler: unknown): TeamKarte {
  // a read rejected without a reason failed all the same
  const text = fehlerText(fehler ?? new Error('rejected'), KEIN_TEAM) ?? '';
  return { art: 'fehler', teamId, text };
}
