import type { ResourceSnapshot } from '@angular/core';
import type { RosterFinds } from '@wolsok/feat-shared-basketball-data';

/** Where a search of a Team's Kader stands (`kaderSucheResource`'s snapshot). */
export type KaderSuchStand = ResourceSnapshot<RosterFinds | undefined>;

/** A search that could read nothing: its Team's Saison failed. */
export const NICHT_LESBAR: RosterFinds = {
  games: new Map(),
  incomplete: true,
};

/** How a search of a Team's Kader ended: with its finds, or failed. */
export type SuchEnde =
  | { readonly art: 'gefunden'; readonly funde: RosterFinds }
  | { readonly art: 'gescheitert' };

/** How a search of a Team's Kader ended; none while it runs. */
export function suchEnde(suche: KaderSuchStand): SuchEnde | undefined {
  if (suche.status === 'error') {
    return { art: 'gescheitert' };
  }
  return suche.value === undefined
    ? undefined
    : { art: 'gefunden', funde: suche.value };
}

/**
 * The finds to show after `ende`, the last ones being `vorher`: a run that
 * failed as a whole keeps them, marked `unvollstaendig`, or reads as one
 * that read nothing; one still running keeps them as they are.
 */
export function fundeNach(
  ende: SuchEnde | undefined,
  vorher: RosterFinds | undefined
): RosterFinds | undefined {
  switch (ende?.art) {
    case 'gefunden':
      return ende.funde;
    case 'gescheitert':
      return vorher ? { ...vorher, incomplete: true } : NICHT_LESBAR;
    case undefined:
      return vorher;
  }
}

/** Whether a search of a Team's Kader still runs, or has yet to start. */
export function sucht(suche: KaderSuchStand): boolean {
  return (
    suche.status === 'loading' ||
    suche.status === 'reloading' ||
    suchEnde(suche) === undefined
  );
}
