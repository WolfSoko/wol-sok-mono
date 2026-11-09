import type { ResourceSnapshot } from '@angular/core';
import type { KaderFunde } from '@wolsok/feat-shared-basketball-data';

/** Where a search of a Team's Kader stands (`kaderSucheResource`'s snapshot). */
export type KaderSuchStand = ResourceSnapshot<KaderFunde | undefined>;

/** A search that could read nothing: its Team's Saison failed. */
export const NICHT_LESBAR: KaderFunde = {
  spiele: new Map(),
  unvollstaendig: true,
};

/** How a search of a Team's Kader ended: with its finds, or failed. */
export type SuchEnde =
  | { readonly art: 'gefunden'; readonly funde: KaderFunde }
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
  vorher: KaderFunde | undefined
): KaderFunde | undefined {
  switch (ende?.art) {
    case 'gefunden':
      return ende.funde;
    case 'gescheitert':
      return vorher ? { ...vorher, unvollstaendig: true } : NICHT_LESBAR;
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
