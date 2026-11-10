import type { IndexedClub } from '@wolsok/feat-shared-basketball-data';

/** The fewest characters a term needs before the search lists Clubs. */
export const MIN_TERM_LENGTH = 2;

/** The most hits the search lists at once; a longer term narrows them. */
export const MAX_HITS = 30;

/** What the search shows for a term over a loaded index. */
export type ClubSearchResult =
  /** Too few characters typed to search yet. */
  | { readonly kind: 'too-short' }
  /** The index holds no Club yet: its first fill is still running. */
  | { readonly kind: 'empty-index' }
  /** No Club's name holds the term; the index may not hold it yet. */
  | { readonly kind: 'no-hits' }
  | {
      readonly kind: 'hits';
      /** At most `MAX_HITS`, by name. */
      readonly clubs: readonly IndexedClub[];
      /** Whether more Clubs match than are listed. */
      readonly more: boolean;
    };

/**
 * What the search over an index of `size` Clubs (searched by `search`)
 * shows for `term`.
 */
export function clubSearchResult(
  size: number,
  search: (term: string) => readonly IndexedClub[],
  term: string
): ClubSearchResult {
  if (size === 0) {
    return { kind: 'empty-index' };
  }
  if (term.trim().length < MIN_TERM_LENGTH) {
    return { kind: 'too-short' };
  }
  const clubs = search(term);
  if (clubs.length === 0) {
    return { kind: 'no-hits' };
  }
  return {
    kind: 'hits',
    clubs: clubs.slice(0, MAX_HITS),
    more: clubs.length > MAX_HITS,
  };
}
