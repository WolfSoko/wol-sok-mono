import type { TeamId } from './ids';
import type { Team } from './team';

/**
 * Who plays on one side of a Spiel or holds a line of a Tabelle: a Team,
 * or a slot the Liga fills later (e.g. "Nord 1. Platz" in a Hauptrunde
 * before its Vorrunde ended).
 */
export type SpielPartei =
  | { readonly art: 'team'; readonly team: Team }
  | { readonly art: 'offen'; readonly bezeichnung: string };

/** Whether `partei` is the Team `team`; a slot is none. */
export function istTeam(partei: SpielPartei, team: TeamId): boolean {
  return partei.art === 'team' && partei.team.id === team;
}

/** A Team's name, or what a slot waits for. */
export function parteiName(partei: SpielPartei): string {
  return partei.art === 'team' ? partei.team.name : partei.bezeichnung;
}
