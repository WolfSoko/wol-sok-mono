import { inject, Injector } from '@angular/core';
import type { TeamId, TeamSaison } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from './basketball-data-resource';

/**
 * A resource reading the Saison of the Team `teamId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function teamSaisonResource(
  teamId: () => TeamId | undefined,
  injector: Injector = inject(Injector)
): DatenResource<TeamSaison | undefined> {
  return basketballDataResource(
    teamId,
    (data, team, options) => data.teamSpiele(team, options),
    injector
  );
}
