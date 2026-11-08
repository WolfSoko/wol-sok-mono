import { inject, Injector, type ResourceRef } from '@angular/core';
import type { LigaId, Team } from '@wolsok/feat-shared-basketball-data';
import { basketballDataResource } from './basketball-data-resource';

/**
 * A resource reading the Teams of the Liga `ligaId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function ligaTeamsResource(
  ligaId: () => LigaId | undefined,
  injector: Injector = inject(Injector)
): ResourceRef<readonly Team[] | undefined> {
  return basketballDataResource(
    ligaId,
    (data, liga, signal) => data.ligaTeams(liga, { signal }),
    injector
  );
}
