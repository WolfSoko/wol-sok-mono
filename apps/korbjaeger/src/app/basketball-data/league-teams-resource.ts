import { inject, Injector } from '@angular/core';
import type { LeagueId, Team } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DataResource,
} from './basketball-data-resource';

/**
 * A resource reading the Teams of the Liga `leagueId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function leagueTeamsResource(
  leagueId: () => LeagueId | undefined,
  injector: Injector = inject(Injector)
): DataResource<readonly Team[] | undefined> {
  return basketballDataResource(
    leagueId,
    (data, league, options) => data.leagueTeams(league, options),
    injector
  );
}
