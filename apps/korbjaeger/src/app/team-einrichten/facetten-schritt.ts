import { computed, inject, Injector, type Signal } from '@angular/core';
import {
  angeboten,
  type Facette,
  type LigaSucheFacetten,
  type LigaSucheFilter,
} from '@wolsok/feat-shared-basketball-data';
import { ligaSucheResource } from '../basketball-data/liga-suche-resource';
import { fehlerText, KEINE_LIGEN } from '../fehler/fehler-text';

/** One step of the Team wizard: the choices of one facet of a search. */
export interface FacettenSchritt<Id> {
  /** The choices that leave Ligen (`angeboten`); none before the search. */
  readonly facetten: Signal<readonly Facette<Id>[]>;
  /** What the step says when its search found no choice at all. */
  readonly leer: Signal<string | undefined>;
  /** Why its search failed; none while it did not. */
  readonly fehler: Signal<string | undefined>;
  readonly laedt: Signal<boolean>;
}

/** The ids of the facet `K`'s choices. */
type FacettenId<K extends keyof LigaSucheFacetten> =
  LigaSucheFacetten[K][number]['id'];

/**
 * The step offering the facet `facette` of the Liga search for `filter`,
 * none while `filter` gives none. A new filter drops the last one's
 * choices and error. Created in an injection context, or on `injector`.
 */
export function facettenSchritt<K extends keyof LigaSucheFacetten>(
  filter: () => LigaSucheFilter | undefined,
  facette: K,
  keineText: string,
  injector: Injector = inject(Injector)
): FacettenSchritt<FacettenId<K>> {
  const suche = ligaSucheResource(filter, injector);
  const facetten = computed((): readonly Facette<FacettenId<K>>[] =>
    suche.hasValue()
      ? angeboten<FacettenId<K>>(suche.value().facetten[facette])
      : []
  );
  return {
    facetten,
    leer: computed(() =>
      suche.hasValue() && facetten().length === 0 ? keineText : undefined
    ),
    fehler: computed(() => fehlerText(suche.error(), KEINE_LIGEN)),
    laedt: suche.isLoading,
  };
}
