import { inject, Injector } from '@angular/core';
import type {
  LigaSuche,
  LigaSucheFilter,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from './basketball-data-resource';

/**
 * A resource reading the Liga search (facets and first page of Ligen) for
 * the filter `filter` gives, none while it gives none; a new filter
 * cancels the read of the last. Created in an injection context, or on
 * `injector`.
 */
export function ligaSucheResource(
  filter: () => LigaSucheFilter | undefined,
  injector: Injector = inject(Injector)
): DatenResource<LigaSuche | undefined> {
  return basketballDataResource(
    filter,
    (data, gegeben, options) => data.ligaSuche(gegeben, options),
    injector
  );
}
