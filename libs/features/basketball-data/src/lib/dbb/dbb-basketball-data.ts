import type { BasketballData, ReadOptions } from '../basketball-data';
import {
  BasketballDataError,
  isBasketballDataError,
} from '../domain/basketball-data-error';
import type { LeagueId, GameId, TeamId, ClubId } from '../domain/ids';
import type {
  LeaguePage,
  LeagueSearch,
  LeagueSearchFilter,
} from '../domain/league-search';
import type { GameDetails } from '../domain/game';
import type { GameReport } from '../domain/game-report';
import type { Standings } from '../domain/standings';
import type { Team } from '../domain/team';
import type { Club } from '../domain/club';
import type { TeamSeason, ClubTeams } from '../domain/team-season';
import {
  assertValidDbbRequest,
  dbbIdOf,
  isDbbId,
  type DbbRequest,
  type DbbTransport,
} from './dbb-request';
import { readEnvelope } from './envelope';
import { mapClubOfGames } from './map-club-of-games';
import { mapLeaguePage, mapLeagueSearch } from './map-league-search';
import { mapLeagueTeams } from './map-league-teams';
import { mapGameDetails } from './map-game-details';
import { mapGameReport } from './map-game-report';
import { mapStandings } from './map-standings';
import { mapTeamGames } from './map-team-games';
import { mapClubTeams } from './map-club-teams';

/**
 * How far either way a Verein's Spiele are looked at for its Teams: four
 * weeks, so a Team pausing over the holidays still shows, and a Team whose
 * Saison ended (two weeks after its last Spiel, `seasonOver`) still
 * finds the Verein's Teams that ended about when it did; ahead, the next
 * Saison's Teams show once their first Spiele are set. Wider would cost
 * every read a longer list for little gain.
 */
export const CLUB_GAMES_DAYS = 28;

/**
 * How far either way a Verein's Spiele are asked for when only the Verein
 * is read (`club`): the least the DBB's day range takes, as its answer
 * carries the Verein whatever the range, and each day more only adds
 * Spiele that are never read.
 */
const CLUB_NAME_DAYS = 1;

/**
 * `BasketballData` read from the DBB's JSON API through `transport`, which
 * answers each allowlisted `DbbRequest` with the DBB's JSON: directly in a
 * tool, through the app's caching proxy in the browser. Each read hands
 * its options (`O`) to the transport as they are.
 */
export class DbbBasketballData<
  O extends ReadOptions = ReadOptions,
> implements BasketballData<O> {
  public constructor(private readonly transport: DbbTransport<O>) {}

  public leagueSearch(
    filter: LeagueSearchFilter,
    options?: O
  ): Promise<LeagueSearch> {
    return this.read(
      { kind: 'league-search', filter },
      mapLeagueSearch,
      options
    );
  }

  public leaguePage(
    filter: LeagueSearchFilter,
    startIndex: number,
    options?: O
  ): Promise<LeaguePage> {
    return this.read(
      { kind: 'league-page', filter, startIndex },
      mapLeaguePage,
      options
    );
  }

  public leagueTeams(league: LeagueId, options?: O): Promise<readonly Team[]> {
    return this.read(
      { kind: 'schedule', leagueId: league },
      mapLeagueTeams,
      options
    );
  }

  public clubTeams(club: ClubId, options?: O): Promise<ClubTeams> {
    return this.read(
      { kind: 'club-games', clubId: club, days: CLUB_GAMES_DAYS },
      mapClubTeams,
      options
    );
  }

  public club(club: ClubId, options?: O): Promise<Club> {
    return this.read(
      { kind: 'club-games', clubId: club, days: CLUB_NAME_DAYS },
      mapClubOfGames,
      options
    );
  }

  public teamGames(team: TeamId, options?: O): Promise<TeamSeason> {
    return this.read(
      { kind: 'team-games', teamId: team },
      mapTeamGames,
      options
    );
  }

  public standings(league: LeagueId, options?: O): Promise<Standings> {
    return this.read(
      { kind: 'standings', leagueId: league },
      mapStandings,
      options
    );
  }

  public game(game: GameId, options?: O): Promise<GameDetails> {
    return this.read(
      { kind: 'game-info', gameId: game },
      mapGameDetails,
      options
    );
  }

  public gameReport(
    game: GameId,
    options?: O
  ): Promise<GameReport | undefined> {
    return this.read(
      { kind: 'game-report', gameId: game },
      mapGameReport,
      options
    );
  }

  private async read<T>(
    request: DbbRequest,
    map: (data: unknown) => T,
    options?: O
  ): Promise<T> {
    assertKnowable(request);
    options?.signal?.throwIfAborted();
    return map(readEnvelope(await this.fetch(request, options)));
  }

  private async fetch(
    request: DbbRequest,
    options: O | undefined
  ): Promise<unknown> {
    try {
      return await this.transport(request, options);
    } catch (error) {
      options?.signal?.throwIfAborted();
      if (isBasketballDataError(error)) {
        throw error;
      }
      throw new BasketballDataError(
        'unavailable',
        `DBB not reachable for ${request.kind}`,
        { cause: error }
      );
    }
  }
}

/**
 * Checks `request` before the transport sees it. An id the DBB cannot have
 * names nothing it knows: `not-found`. Anything else wrong (a negative
 * start index, a malformed filter) is the caller's bug and throws its
 * `RangeError` as it is. What the transport throws afterwards is the
 * DBB's or the network's trouble: `unavailable`.
 */
function assertKnowable(request: DbbRequest): void {
  const id = dbbIdOf(request);
  if (id !== undefined && !isDbbId(id)) {
    throw new BasketballDataError('not-found', `not a DBB id: ${id}`);
  }
  assertValidDbbRequest(request);
}
