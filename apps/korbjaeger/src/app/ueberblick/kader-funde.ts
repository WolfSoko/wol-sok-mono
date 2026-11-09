import type { KaderFunde } from '@wolsok/feat-shared-basketball-data';
import type { DatenResource } from '../basketball-data/basketball-data-resource';

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
export function suchEnde(
  suche: DatenResource<KaderFunde | undefined>
): SuchEnde | undefined {
  if (suche.hasValue()) {
    return { art: 'gefunden', funde: suche.value() };
  }
  return suche.status() === 'error' ? { art: 'gescheitert' } : undefined;
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
export function sucht(suche: DatenResource<KaderFunde | undefined>): boolean {
  return suche.isLoading() || suchEnde(suche) === undefined;
}
