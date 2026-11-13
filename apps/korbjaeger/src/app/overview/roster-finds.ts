import type { ResourceSnapshot } from '@angular/core';
import type { RosterFinds } from '@wolsok/feat-shared-basketball-data';

/** Where a search of a Team's Kader stands (`rosterSearchResource`'s snapshot). */
export type RosterSearchState = ResourceSnapshot<RosterFinds | undefined>;

/** A search that could read nothing: its Team's Saison failed. */
export const UNREADABLE: RosterFinds = {
  games: new Map(),
  incomplete: true,
};

/** How a search of a Team's Kader ended: with its finds, or failed. */
export type SearchEnd =
  | { readonly kind: 'found'; readonly finds: RosterFinds }
  | { readonly kind: 'failed' };

/** How a search of a Team's Kader ended; none while it runs. */
export function searchEnd(search: RosterSearchState): SearchEnd | undefined {
  if (search.status === 'error') {
    return { kind: 'failed' };
  }
  return search.value === undefined
    ? undefined
    : { kind: 'found', finds: search.value };
}

/**
 * The finds to show after `end`, the last ones being `before`: a run that
 * failed as a whole keeps them, marked `incomplete`, or reads as one
 * that read nothing; one still running keeps them as they are.
 */
export function findsAfter(
  end: SearchEnd | undefined,
  before: RosterFinds | undefined
): RosterFinds | undefined {
  switch (end?.kind) {
    case 'found':
      return end.finds;
    case 'failed':
      return before ? { ...before, incomplete: true } : UNREADABLE;
    case undefined:
      return before;
  }
}

/** Whether a search of a Team's Kader still runs, or has yet to start. */
export function searching(search: RosterSearchState): boolean {
  return (
    search.status === 'loading' ||
    search.status === 'reloading' ||
    searchEnd(search) === undefined
  );
}
