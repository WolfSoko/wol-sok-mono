import { inject, Injector, resource, type ResourceRef } from '@angular/core';
import type { TeamId, TeamSaison } from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from './basketball-data.provider';

/**
 * A resource reading the Saison of the Team `teamId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function teamSaisonResource(
  teamId: () => TeamId | undefined,
  injector: Injector = inject(Injector)
): ResourceRef<TeamSaison | undefined> {
  const data = injector.get(BASKETBALL_DATA);
  return resource({
    params: teamId,
    loader: ({ params, abortSignal }) =>
      data.teamSpiele(params, { signal: abortSignal }),
    injector,
  });
}
