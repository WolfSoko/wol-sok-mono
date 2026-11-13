import { inject, Injector } from '@angular/core';
import type {
  LeagueSearch,
  LeagueSearchFilter,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DataResource,
} from './basketball-data-resource';

/**
 * A resource reading the Liga search (facets and first page of Ligen) for
 * the filter `filter` gives, none while it gives none; a new filter
 * cancels the read of the last. Created in an injection context, or on
 * `injector`.
 */
export function leagueSearchResource(
  filter: () => LeagueSearchFilter | undefined,
  injector: Injector = inject(Injector)
): DataResource<LeagueSearch | undefined> {
  return basketballDataResource(
    filter,
    (data, given, options) => data.leagueSearch(given, options),
    injector
  );
}
