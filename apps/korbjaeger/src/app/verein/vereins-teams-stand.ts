import type { Resource } from '@angular/core';
import type { TeamId, ClubTeams } from '@wolsok/feat-shared-basketball-data';
import { fehlerText, KEIN_VEREIN } from '../fehler/fehler-text';

/** One Team of a Verein as `VereinsTeamsComponent` lists it. */
export interface VereinsTeamZeile {
  readonly teamId: TeamId;
  readonly name: string;
  /** The Ligen it played in, so Teams of one name tell apart. */
  readonly ligen: string;
}

/** Where the read of a Verein's Teams stands, as `VereinsTeamsComponent` shows it. */
export type VereinsTeamsStand =
  | { readonly art: 'laedt' }
  | { readonly art: 'fehler'; readonly text: string }
  | { readonly art: 'gelesen'; readonly teams: readonly VereinsTeamZeile[] };

/**
 * The Verein's Teams (other than `ohne`, where given) as their read
 * stands: `undefined` while it reads nothing (no Verein to read yet). A
 * read again keeps showing the Teams it had.
 */
export function vereinsTeamsStand(
  read: Resource<ClubTeams | undefined>,
  ohne?: TeamId
): VereinsTeamsStand | undefined {
  if (read.status() === 'idle') {
    return undefined;
  }
  const text = fehlerText(read.error(), KEIN_VEREIN);
  if (text !== undefined) {
    return { art: 'fehler', text };
  }
  return read.hasValue()
    ? { art: 'gelesen', teams: zeilen(read.value(), ohne) }
    : { art: 'laedt' };
}

function zeilen(
  vereinsTeams: ClubTeams,
  ohne: TeamId | undefined
): readonly VereinsTeamZeile[] {
  return vereinsTeams.teams
    .filter(({ team }) => team.id !== ohne)
    .map(({ team, leagues: ligen }) => ({
      teamId: team.id,
      name: team.name,
      ligen: ligen.map((liga) => liga.name).join(' · '),
    }));
}
