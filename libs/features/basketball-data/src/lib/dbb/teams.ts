import type { Participant } from '../domain/participant';
import type { Team } from '../domain/team';

const BY_NAME = new Intl.Collator('de');

/** Each Team among `participants` once, by name; open slots are left out. */
export function distinctTeams(
  participants: readonly Participant[]
): readonly Team[] {
  const teams = new Map<number, Team>();
  for (const participant of participants) {
    if (participant.kind === 'team' && !teams.has(participant.team.id)) {
      teams.set(participant.team.id, participant.team);
    }
  }
  return [...teams.values()].sort(byName);
}

/** Orders Teams by name, the way German readers expect. */
export function byName(a: Team, b: Team): number {
  return BY_NAME.compare(a.name, b.name) || a.id - b.id;
}
