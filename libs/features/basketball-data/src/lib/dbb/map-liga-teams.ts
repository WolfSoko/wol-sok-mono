import type { Team } from '../domain/team';
import { DbbObject } from './dbb-object';
import { mapSpiel } from './map-spiel';
import { distinctTeams } from './teams';

/**
 * The Teams of a Liga, from its Spielplan (`competition/spielplan/id/{id}`),
 * by name; slots still waiting for a Team are left out.
 */
export function mapLigaTeams(data: unknown): readonly Team[] {
  const spielplan = DbbObject.of(data, 'spielplan');
  const ligaId = spielplan.object('ligaData').number('ligaId');
  const spiele = spielplan
    .optionalObjects('matches')
    .map((match) => mapSpiel(match, ligaId));
  return distinctTeams(spiele.flatMap((spiel) => [spiel.heim, spiel.gast]));
}
