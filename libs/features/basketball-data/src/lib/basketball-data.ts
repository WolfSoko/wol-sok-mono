import type { LeagueId, GameId, TeamId, ClubId } from './domain/ids';
import type {
  LeaguePage,
  LeagueSearch,
  LeagueSearchFilter,
} from './domain/league-search';
import type { GameDetails } from './domain/game';
import type { GameReport } from './domain/game-report';
import type { Standings } from './domain/standings';
import type { Team } from './domain/team';
import type { Club } from './domain/club';
import type { TeamSeason, ClubTeams } from './domain/team-season';

/**
 * The part of an `AbortSignal` a read uses. A browser's or Node's
 * `AbortSignal` is one; the lib compiles without either's types.
 */
export interface ReadSignal {
  readonly aborted: boolean;
  readonly reason: unknown;
  throwIfAborted(): void;
  addEventListener(
    type: 'abort',
    listener: () => void,
    options?: { readonly once?: boolean }
  ): void;
}

/**
 * What every read, and the transport under it, takes beside its ids. An
 * app may widen it with fields its transport reads (`BasketballData<O>`,
 * `DbbTransport<O>`): a read hands its options to the transport as they
 * are.
 */
export interface ReadOptions {
  /** Cancels the read: it then rejects with the signal's reason. */
  readonly signal?: ReadSignal;
}

/**
 * The basketball data the app reads, in domain terms. Every read rejects
 * with a `BasketballDataError` only: `not-found`, `offline` (a transport
 * that knows the reader's network is down), `unavailable` or
 * `unexpected-shape`; a cancelled one with its signal's reason.
 * `DbbBasketballData` reads it from the DBB; an official source would be
 * another adapter. `O`: the options its reads take.
 */
export interface BasketballData<O extends ReadOptions = ReadOptions> {
  /** The search facets and the first page of Ligen for `filter`. */
  leagueSearch(filter: LeagueSearchFilter, options?: O): Promise<LeagueSearch>;
  /** A later page of the Ligen for `filter`, from `startIndex` on. */
  leaguePage(
    filter: LeagueSearchFilter,
    startIndex: number,
    options?: O
  ): Promise<LeaguePage>;
  /** The Teams of a Liga, by name. */
  leagueTeams(league: LeagueId, options?: O): Promise<readonly Team[]>;
  /** The Teams seen in a Verein's Spiele of the last and next weeks. */
  clubTeams(club: ClubId, options?: O): Promise<ClubTeams>;
  /** A Verein alone, by its id: its name without its Spiele. */
  club(club: ClubId, options?: O): Promise<Club>;
  /** All Spiele of a Team in the Saison, across its Ligen, by date. */
  teamGames(team: TeamId, options?: O): Promise<TeamSeason>;
  standings(league: LeagueId, options?: O): Promise<Standings>;
  /** A Spiel's result, quarters and Halle. */
  game(game: GameId, options?: O): Promise<GameDetails>;
  /** Both Kader of a Spiel, or `undefined` while there is no Spielbericht. */
  gameReport(game: GameId, options?: O): Promise<GameReport | undefined>;
}
