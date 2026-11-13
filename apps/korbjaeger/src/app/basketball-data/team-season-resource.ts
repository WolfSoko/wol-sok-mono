import { inject, Injector } from '@angular/core';
import type { TeamId, TeamSeason } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DataResource,
} from './basketball-data-resource';

/**
 * A resource reading the Saison of the Team `teamId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function teamSeasonResource(
  teamId: () => TeamId | undefined,
  injector: Injector = inject(Injector)
): DataResource<TeamSeason | undefined> {
  return basketballDataResource(
    teamId,
    (data, team, options) => data.teamGames(team, options),
    injector
  );
}
