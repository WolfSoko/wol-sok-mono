import type { TeamSeason } from '../domain/team-season';
import { DbbObject } from './dbb-object';
import { mapClub } from './map-club';
import { chronological, distinctLeagues, mapGamesInLeagues } from './games';

/**
 * A Team's Saison (`team/id/{teamPermanentId}/matches`): its Spiele in every
 * Liga it plays in, a Vorrunde and a Hauptrunde alike, in one list by date.
 */
export function mapTeamGames(data: unknown): TeamSeason {
  const response = DbbObject.of(data, 'teamMatches');
  const team = response.object('team');
  const club = mapClub(team.object('club'));
  const games = chronological(
    mapGamesInLeagues(response.optionalObjects('matches'))
  );
  return {
    team: {
      id: team.number('teamId'),
      name: team.string('teamName').trim(),
      clubId: club.id,
    },
    club,
    leagues: distinctLeagues(games.map(({ league }) => league)),
    games: games.map(({ game }) => game),
  };
}
