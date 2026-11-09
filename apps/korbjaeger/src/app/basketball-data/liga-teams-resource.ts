import { inject, Injector } from '@angular/core';
import type { LigaId, Team } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from './basketball-data-resource';

/**
 * A resource reading the Teams of the Liga `ligaId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function ligaTeamsResource(
  ligaId: () => LigaId | undefined,
  injector: Injector = inject(Injector)
): DatenResource<readonly Team[] | undefined> {
  return basketballDataResource(
    ligaId,
    (data, liga, options) => data.ligaTeams(liga, options),
    injector
  );
}
