import type { Team } from '../domain/team';
import { DbbObject } from './dbb-object';
import { mapGame } from './map-game';
import { distinctTeams } from './teams';

/**
 * The Teams of a Liga, from its Spielplan (`competition/spielplan/id/{id}`),
 * by name; slots still waiting for a Team are left out.
 */
export function mapLeagueTeams(data: unknown): readonly Team[] {
  const schedule = DbbObject.of(data, 'spielplan');
  const leagueId = schedule.object('ligaData').number('ligaId');
  const games = schedule
    .optionalObjects('matches')
    .map((match) => mapGame(match, leagueId));
  return distinctTeams(games.flatMap((game) => [game.home, game.away]));
}
