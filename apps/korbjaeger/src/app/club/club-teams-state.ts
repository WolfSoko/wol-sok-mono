import type { Resource } from '@angular/core';
import type { TeamId, ClubTeams } from '@wolsok/feat-shared-basketball-data';
import { errorText, NO_CLUB } from '../errors/error-text';

/** One Team of a Verein as `ClubTeamsComponent` lists it. */
export interface ClubTeamRow {
  readonly teamId: TeamId;
  readonly name: string;
  /** The Ligen it played in, so Teams of one name tell apart. */
  readonly leagues: string;
}

/** Where the read of a Verein's Teams stands, as `ClubTeamsComponent` shows it. */
export type ClubTeamsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly text: string }
  | { readonly kind: 'read'; readonly teams: readonly ClubTeamRow[] };

/**
 * The Verein's Teams (other than `without`, where given) as their read
 * stands: `undefined` while it reads nothing (no Verein to read yet). A
 * read again keeps showing the Teams it had.
 */
export function clubTeamsState(
  read: Resource<ClubTeams | undefined>,
  without?: TeamId
): ClubTeamsState | undefined {
  if (read.status() === 'idle') {
    return undefined;
  }
  const text = errorText(read.error(), NO_CLUB);
  if (text !== undefined) {
    return { kind: 'error', text };
  }
  return read.hasValue()
    ? { kind: 'read', teams: rows(read.value(), without) }
    : { kind: 'loading' };
}

function rows(
  clubTeams: ClubTeams,
  without: TeamId | undefined
): readonly ClubTeamRow[] {
  return clubTeams.teams
    .filter(({ team }) => team.id !== without)
    .map(({ team, leagues }) => ({
      teamId: team.id,
      name: team.name,
      leagues: leagues.map((league) => league.name).join(' · '),
    }));
}
