import type { Resource } from '@angular/core';
import type { TeamId, VereinsTeams } from '@wolsok/feat-shared-basketball-data';
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
 * The Verein's Teams other than `ohne` as their read stands: `undefined`
 * while it reads nothing (no Verein to read yet).
 */
export function vereinsTeamsStand(
  read: Resource<VereinsTeams | undefined>,
  ohne: TeamId
): VereinsTeamsStand | undefined {
  switch (read.status()) {
    case 'idle':
      return undefined;
    case 'error':
      return {
        art: 'fehler',
        // a read rejected without a reason failed all the same
        text:
          fehlerText(read.error() ?? new Error('rejected'), KEIN_VEREIN) ?? '',
      };
    case 'resolved':
    case 'local':
      return { art: 'gelesen', teams: zeilen(read.value(), ohne) };
    default:
      return { art: 'laedt' };
  }
}

function zeilen(
  vereinsTeams: VereinsTeams | undefined,
  ohne: TeamId
): readonly VereinsTeamZeile[] {
  return (vereinsTeams?.teams ?? [])
    .filter(({ team }) => team.id !== ohne)
    .map(({ team, ligen }) => ({
      teamId: team.id,
      name: team.name,
      ligen: ligen.map((liga) => liga.name).join(' · '),
    }));
}
