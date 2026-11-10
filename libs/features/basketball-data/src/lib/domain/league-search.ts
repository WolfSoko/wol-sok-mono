import type { AgeGroupGenderId, AgeGroupId, AssociationId } from './ids';
import type { League } from './league';

/** What the Liga search narrows to; an empty list narrows nothing. */
export interface LeagueSearchFilter {
  readonly associationIds: readonly AssociationId[];
  readonly ageGroupIds: readonly AgeGroupId[];
  readonly ageGroupGenderIds: readonly AgeGroupGenderId[];
}

/** One choice of a search facet, with how many Ligen it leaves. */
export interface Facet<Id> {
  readonly id: Id;
  readonly name: string;
  readonly hits: number;
}

/** The facets the Liga search offers for the current filter. */
export interface LeagueSearchFacets {
  readonly associations: readonly Facet<AssociationId>[];
  readonly ageGroups: readonly Facet<AgeGroupId>[];
  /** Named like `Jugend männlich`. */
  readonly ageGroupGenders: readonly Facet<AgeGroupGenderId>[];
}

/** One page of the Ligen a filter finds. */
export interface LeaguePage {
  readonly startIndex: number;
  readonly leagues: readonly League[];
  /** Whether a page after this one exists (at `startIndex + leagues.length`). */
  readonly more: boolean;
}

/** The facets and the first page of Ligen for a filter. */
export interface LeagueSearch {
  readonly facets: LeagueSearchFacets;
  readonly firstPage: LeaguePage;
}

/** A filter that narrows nothing. */
export const NO_LEAGUE_FILTER: LeagueSearchFilter = {
  associationIds: [],
  ageGroupIds: [],
  ageGroupGenderIds: [],
};

/**
 * Where the page after `page` starts, for `leaguePage`; `undefined` when
 * `page` is the last.
 */
export function nextStartIndex(page: LeaguePage): number | undefined {
  return page.more ? page.startIndex + page.leagues.length : undefined;
}

/**
 * The choices of a facet that leave any Ligen, in the DBB's order: what a
 * search offers for the current filter, e.g. the age groups a Verband has.
 */
export function offered<Id>(
  facets: readonly Facet<Id>[]
): readonly Facet<Id>[] {
  return facets.filter((facet) => facet.hits > 0);
}
