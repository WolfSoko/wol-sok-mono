import { inject, Injector } from '@angular/core';
import type { ClubId, ClubTeams } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DataResource,
} from './basketball-data-resource';

/**
 * A resource reading the Teams of the Verein `clubId` gives, as its
 * recent Spiele show them, none while it gives none; a new id cancels the
 * read of the last. Created in an injection context, or on `injector`.
 */
export function clubTeamsResource(
  clubId: () => ClubId | undefined,
  injector: Injector = inject(Injector)
): DataResource<ClubTeams | undefined> {
  return basketballDataResource(
    clubId,
    (data, club, options) => data.clubTeams(club, options),
    injector
  );
}
