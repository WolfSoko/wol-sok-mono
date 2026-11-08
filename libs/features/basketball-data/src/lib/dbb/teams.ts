import type { SpielPartei } from '../domain/spiel';
import type { Team } from '../domain/team';

const BY_NAME = new Intl.Collator('de');

/** Each Team among `parteien` once, by name; open slots are left out. */
export function distinctTeams(
  parteien: readonly SpielPartei[]
): readonly Team[] {
  const teams = new Map<number, Team>();
  for (const partei of parteien) {
    if (partei.art === 'team' && !teams.has(partei.team.id)) {
      teams.set(partei.team.id, partei.team);
    }
  }
  return [...teams.values()].sort(byName);
}

/** Orders Teams by name, the way German readers expect. */
export function byName(a: Team, b: Team): number {
  return BY_NAME.compare(a.name, b.name) || a.id - b.id;
}
