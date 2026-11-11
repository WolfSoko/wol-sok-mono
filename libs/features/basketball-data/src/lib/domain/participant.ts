import type { TeamId } from './ids';
import type { Team } from './team';

/**
 * Who plays on one side of a Spiel or holds a line of a Tabelle: a Team,
 * or a slot the Liga fills later (e.g. "Nord 1. Platz" in a Hauptrunde
 * before its Vorrunde ended).
 */
export type Participant =
  | { readonly kind: 'team'; readonly team: Team }
  | { readonly kind: 'open'; readonly label: string };

/** Whether `participant` is the Team `team`; a slot is none. */
export function isTeam(participant: Participant, team: TeamId): boolean {
  return participant.kind === 'team' && participant.team.id === team;
}

/** A Team's name, or what a slot waits for. */
export function participantName(participant: Participant): string {
  return participant.kind === 'team'
    ? participant.team.name
    : participant.label;
}
