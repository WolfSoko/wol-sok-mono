import { inject, Injector } from '@angular/core';
import {
  searchRosters,
  type RosterFinds,
  type RosterSearchJob,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DataResource,
} from '../basketball-data/basketball-data-resource';
import { sameSequence } from '@wolsok/feat-korbjaeger-selection';

/**
 * How many of a Team's last played Spiele the overview looks into for the
 * marked Kinder (`lastPlayed`). A Kind missing from all of them
 * leaves the Team among the Teams without a Kind.
 */
export const ROSTER_SEARCH_GAMES = 5;

/**
 * A resource running `searchRosters` for the order `job` gives, none
 * while it gives none; a new order cancels the last. Created in an
 * injection context, or on `injector`.
 */
export function rosterSearchResource(
  job: () => RosterSearchJob | undefined,
  injector: Injector = inject(Injector)
): DataResource<RosterFinds | undefined> {
  return basketballDataResource(job, searchRosters, injector);
}

/**
 * Whether the search for `b` need not run again after the one for `a`:
 * the same Team and Spiele, and Kinder `a` looked for already. A Kind
 * unmarked thus starts no search; the finds of the others stay as they
 * are, those of the Kind unmarked unused.
 */
export function sameJob(
  a: RosterSearchJob | undefined,
  b: RosterSearchJob | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return (
    a.team === b.team &&
    sameSequence(
      a.games.map(({ id }) => id),
      b.games.map(({ id }) => id)
    ) &&
    b.children.length > 0 &&
    b.children.every((person) => a.children.includes(person))
  );
}
