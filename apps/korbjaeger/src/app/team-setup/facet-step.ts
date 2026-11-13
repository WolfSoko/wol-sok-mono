import { computed, inject, Injector, type Signal } from '@angular/core';
import {
  offered,
  type Facet,
  type LeagueSearchFacets,
  type LeagueSearchFilter,
} from '@wolsok/feat-shared-basketball-data';
import { leagueSearchResource } from '../basketball-data/league-search-resource';
import { errorText, NO_LEAGUES } from '../errors/error-text';

/** One step of the Team wizard: the choices of one facet of a search. */
export interface FacetStep<Id> {
  /** The choices that leave Ligen (`angeboten`); none before the search. */
  readonly facets: Signal<readonly Facet<Id>[]>;
  /** What the step says when its search found no choice at all. */
  readonly empty: Signal<string | undefined>;
  /** Why its search failed; none while it did not. */
  readonly error: Signal<string | undefined>;
  readonly loading: Signal<boolean>;
}

/** The ids of the facet `K`'s choices. */
type FacetId<K extends keyof LeagueSearchFacets> =
  LeagueSearchFacets[K][number]['id'];

/**
 * The step offering the facet `facet` of the Liga search for `filter`,
 * none while `filter` gives none. A new filter drops the last one's
 * choices and error. Created in an injection context, or on `injector`.
 */
export function facetStep<K extends keyof LeagueSearchFacets>(
  filter: () => LeagueSearchFilter | undefined,
  facet: K,
  noneText: string,
  injector: Injector = inject(Injector)
): FacetStep<FacetId<K>> {
  const search = leagueSearchResource(filter, injector);
  const facets = computed((): readonly Facet<FacetId<K>>[] =>
    search.hasValue() ? offered<FacetId<K>>(search.value().facets[facet]) : []
  );
  return {
    facets,
    empty: computed(() =>
      search.hasValue() && facets().length === 0 ? noneText : undefined
    ),
    error: computed(() => errorText(search.error(), NO_LEAGUES)),
    loading: search.isLoading,
  };
}
