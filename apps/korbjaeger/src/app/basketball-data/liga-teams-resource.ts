import { inject, Injector, resource, type ResourceRef } from '@angular/core';
import type { LigaId, Team } from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from './basketball-data.provider';

/**
 * A resource reading the Teams of the Liga `ligaId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function ligaTeamsResource(
  ligaId: () => LigaId | undefined,
  injector: Injector = inject(Injector)
): ResourceRef<readonly Team[] | undefined> {
  const data = injector.get(BASKETBALL_DATA);
  return resource({
    params: ligaId,
    loader: ({ params, abortSignal }) =>
      data.ligaTeams(params, { signal: abortSignal }),
    injector,
  });
}
