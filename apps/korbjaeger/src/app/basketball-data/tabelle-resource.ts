import { inject, Injector } from '@angular/core';
import type { LigaId, Tabelle } from '@wolsok/feat-shared-basketball-data';
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
  ligaId: () => LigaId | undefined,
  injector: Injector = inject(Injector)
): DatenResource<Tabelle | undefined> {
  return basketballDataResource(
    ligaId,
    (data, liga, options) => data.tabelle(liga, options),
    injector
  );
}
