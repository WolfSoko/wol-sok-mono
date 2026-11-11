import type { Resource } from '@angular/core';
import type { Venue, GameDetails } from '@wolsok/feat-shared-basketball-data';
import { fehlerText, KEIN_SPIEL } from '../fehler/fehler-text';

/** Where the read of a Spiel's Halle stands, as `SpielHalleComponent` shows it. */
export type HallenStand =
  | { readonly art: 'laedt' }
  | { readonly art: 'fehler'; readonly text: string }
  /** Read; `halle` absent while the DBB names none. */
  | { readonly art: 'gelesen'; readonly halle?: Venue };

/**
 * The Halle part of a Spiel's details read: `undefined` while it reads
 * nothing (no Spiel to read yet).
 */
export function hallenStand(
  details: Resource<GameDetails | undefined>
): HallenStand | undefined {
  switch (details.status()) {
    case 'idle':
      return undefined;
    case 'error':
      return {
        art: 'fehler',
        // a read rejected without a reason failed all the same
        text:
          fehlerText(details.error() ?? new Error('rejected'), KEIN_SPIEL) ??
          '',
      };
    case 'resolved':
    case 'local': {
      const halle = details.value()?.venue;
      return halle === undefined
        ? { art: 'gelesen' }
        : { art: 'gelesen', halle };
    }
    default:
      return { art: 'laedt' };
  }
}
