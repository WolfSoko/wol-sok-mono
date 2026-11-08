import type { TeamSaison } from '../domain/team-saison';
import { DbbObject } from './dbb-object';
import { mapVerein } from './map-verein';
import { chronologisch, distinctLigen, mapSpieleInLigen } from './spiele';

/**
 * A Team's Saison (`team/id/{teamPermanentId}/matches`): its Spiele in every
 * Liga it plays in, a Vorrunde and a Hauptrunde alike, in one list by date.
 */
export function mapTeamSpiele(data: unknown): TeamSaison {
  const response = DbbObject.of(data, 'teamMatches');
  const team = response.object('team');
  const verein = mapVerein(team.object('club'));
  const spiele = chronologisch(
    mapSpieleInLigen(response.optionalObjects('matches'))
  );
  return {
    team: {
      id: team.number('teamId'),
      name: team.string('teamName').trim(),
      vereinId: verein.id,
    },
    verein,
    ligen: distinctLigen(spiele.map(({ liga }) => liga)),
    spiele: spiele.map(({ spiel }) => spiel),
  };
}
