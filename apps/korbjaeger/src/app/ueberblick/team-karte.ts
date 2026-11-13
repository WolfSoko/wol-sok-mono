import type {
  Game,
  TeamId,
  TeamSeason,
  TeamOverview,
  Club,
} from '@wolsok/feat-shared-basketball-data';
import { errorText, NO_TEAM } from '../errors/error-text';
import type { AsOf } from '../basketball-data/as-of';
import type { VenueState } from '../venue/venue-state';
import { gameRow, type GameRow } from '../game/game-row';
import type { ClubTeamsState } from '../club/club-teams-state';

/** What a card shows beside a Team's Saison, from the overview's reads. */
export interface KartenZusatz {
  /** Where the Saison is its last good data: since when, and why. */
  readonly stand?: AsOf;
  /** The read of the next Spiel's Halle, once it started. */
  readonly halle?: VenueState;
  /** Whether the Team's Saison looks over (`seasonOver`). */
  readonly saisonBeendet: boolean;
  /** The read of the Verein's Teams to suggest, once it started. */
  readonly vereinsTeams?: ClubTeamsState;
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
      readonly verein: Club;
      /** The next Spiel, by which the overview orders the cards. */
      readonly naechstesSpiel?: Game;
      readonly naechstes?: GameRow;
      readonly ausfaelle: readonly GameRow[];
      readonly letztes?: GameRow;
    } & KartenZusatz);

/** The Team's name on a card, or its id while no read has given a name. */
export function kartenName(karte: TeamKarte): string {
  return karte.art === 'geladen' ? karte.name : `Team ${karte.teamId}`;
}

/**
 * The card of a Team whose Saison was read, from its overview
 * (`teamOverview`), with `zusatz`.
 */
export function geladeneKarte(
  saison: TeamSeason,
  { next: naechstes, cancellations: ausfaelle, last: letztes }: TeamOverview,
  zusatz: KartenZusatz
): TeamKarte {
  return {
    art: 'geladen',
    teamId: saison.team.id,
    name: saison.team.name,
    verein: saison.club,
    naechstesSpiel: naechstes,
    naechstes: naechstes && gameRow(saison, naechstes),
    ausfaelle: ausfaelle.map((spiel) => gameRow(saison, spiel)),
    letztes: letztes && gameRow(saison, letztes),
    ...zusatz,
  };
}

/** The card of a Team whose read failed with `fehler`. */
export function fehlerKarte(teamId: TeamId, fehler: unknown): TeamKarte {
  // a read rejected without a reason failed all the same
  const text = errorText(fehler ?? new Error('rejected'), NO_TEAM) ?? '';
  return { art: 'fehler', teamId, text };
}
