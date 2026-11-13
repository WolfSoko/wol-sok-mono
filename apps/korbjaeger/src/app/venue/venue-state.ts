import type { Resource } from '@angular/core';
import type { Venue, GameDetails } from '@wolsok/feat-shared-basketball-data';
import { errorText, NO_GAME } from '../errors/error-text';

/** Where the read of a Spiel's Halle stands, as `GameVenueComponent` shows it. */
export type VenueState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly text: string }
  /** Read; `halle` absent while the DBB names none. */
  | { readonly kind: 'read'; readonly venue?: Venue };

/**
 * The Halle part of a Spiel's details read: `undefined` while it reads
 * nothing (no Spiel to read yet).
 */
export function venueState(
  details: Resource<GameDetails | undefined>
): VenueState | undefined {
  switch (details.status()) {
    case 'idle':
      return undefined;
    case 'error':
      return {
        kind: 'error',
        // a read rejected without a reason failed all the same
        text:
          errorText(details.error() ?? new Error('rejected'), NO_GAME) ?? '',
      };
    case 'resolved':
    case 'local': {
      const venue = details.value()?.venue;
      return venue === undefined ? { kind: 'read' } : { kind: 'read', venue };
    }
    default:
      return { kind: 'loading' };
  }
}
