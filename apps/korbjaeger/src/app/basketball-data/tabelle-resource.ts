import { inject, Injector } from '@angular/core';
import type { LeagueId, Standings } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from './basketball-data-resource';

/**
 * A resource reading the Tabelle of the Liga `ligaId` gives, none while it
 * gives none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function tabelleResource(
  ligaId: () => LeagueId | undefined,
  injector: Injector = inject(Injector)
): DatenResource<Standings | undefined> {
  return basketballDataResource(
    ligaId,
    (data, liga, options) => data.standings(liga, options),
    injector
  );
}
