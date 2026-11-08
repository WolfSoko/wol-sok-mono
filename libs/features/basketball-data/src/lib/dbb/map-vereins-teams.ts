import type { Liga } from '../domain/liga';
import type { SpielPartei } from '../domain/spiel';
import type { Team } from '../domain/team';
import type { VereinsTeam, VereinsTeams } from '../domain/team-saison';
import type { VereinId } from '../domain/ids';
import { DbbObject } from './dbb-object';
import {
  chronologisch,
  distinctLigen,
  mapSpieleInLigen,
  type SpielInLiga,
} from './spiele';
import { byName } from './teams';

/**
 * A Verein's Teams as its recent Spiele show them
 * (`club/id/{clubId}/actualmatches`), each with the Ligen it played in.
 */
export function mapVereinsTeams(data: unknown): VereinsTeams {
  const response = DbbObject.of(data, 'clubMatches');
  const club = response.object('club');
  const verein = {
    id: club.number('vereinId'),
    name: club.string('vereinsname').trim(),
  };
  const spiele = chronologisch(
    mapSpieleInLigen(response.optionalObjects('matches'))
  );
  return { verein, teams: teamsOf(verein.id, spiele) };
}

function teamsOf(
  vereinId: VereinId,
  spiele: readonly SpielInLiga[]
): readonly VereinsTeam[] {
  const seen = new Map<number, { team: Team; ligen: Liga[] }>();
  for (const { spiel, liga } of spiele) {
    for (const team of vereinsTeams(vereinId, [spiel.heim, spiel.gast])) {
      const entry = seen.get(team.id) ?? { team, ligen: [] };
      entry.ligen.push(liga);
      seen.set(team.id, entry);
    }
  }
  return [...seen.values()]
    .map(({ team, ligen }) => ({ team, ligen: distinctLigen(ligen) }))
    .sort((a, b) => byName(a.team, b.team));
}

function vereinsTeams(
  vereinId: VereinId,
  parteien: readonly SpielPartei[]
): readonly Team[] {
  return parteien.flatMap((partei) =>
    partei.art === 'team' && partei.team.vereinId === vereinId
      ? [partei.team]
      : []
  );
}
