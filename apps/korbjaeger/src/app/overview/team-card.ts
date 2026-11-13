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
export interface CardExtras {
  /** Where the Saison is its last good data: since when, and why. */
  readonly asOf?: AsOf;
  /** The read of the next Spiel's Halle, once it started. */
  readonly venue?: VenueState;
  /** Whether the Team's Saison looks over (`seasonOver`). */
  readonly seasonOver: boolean;
  /** The read of the Verein's Teams to suggest, once it started. */
  readonly clubTeams?: ClubTeamsState;
}

/** One of Meine Teams on the overview, as its card shows it. */
export type TeamCard =
  | { readonly kind: 'loading'; readonly teamId: TeamId }
  | { readonly kind: 'error'; readonly teamId: TeamId; readonly text: string }
  | ({
      readonly kind: 'loaded';
      readonly teamId: TeamId;
      readonly name: string;
      /** The Team's Verein, whose colours the card wears. */
      readonly club: Club;
      /** The next Spiel, by which the overview orders the cards. */
      readonly nextGame?: Game;
      readonly next?: GameRow;
      readonly cancellations: readonly GameRow[];
      readonly last?: GameRow;
    } & CardExtras);

/** The Team's name on a card, or its id while no read has given a name. */
export function cardName(card: TeamCard): string {
  return card.kind === 'loaded' ? card.name : `Team ${card.teamId}`;
}

/**
 * The card of a Team whose Saison was read, from its overview
 * (`teamOverview`), with `extras`.
 */
export function loadedCard(
  season: TeamSeason,
  { next, cancellations, last }: TeamOverview,
  extras: CardExtras
): TeamCard {
  return {
    kind: 'loaded',
    teamId: season.team.id,
    name: season.team.name,
    club: season.club,
    nextGame: next,
    next: next && gameRow(season, next),
    cancellations: cancellations.map((game) => gameRow(season, game)),
    last: last && gameRow(season, last),
    ...extras,
  };
}

/** The card of a Team whose read failed with `error`. */
export function errorCard(teamId: TeamId, error: unknown): TeamCard {
  // a read rejected without a reason failed all the same
  const text = errorText(error ?? new Error('rejected'), NO_TEAM) ?? '';
  return { kind: 'error', teamId, text };
}
