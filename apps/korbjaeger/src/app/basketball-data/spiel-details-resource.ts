import { inject, Injector, type ResourceRef } from '@angular/core';
import type {
  SpielDetails,
  SpielId,
} from '@wolsok/feat-shared-basketball-data';
import { basketballDataResource } from './basketball-data-resource';

/**
 * A resource reading the details (result, quarters, Halle) of the Spiel
 * `spielId` gives, none while it gives none; a new id cancels the read of
 * the last. Created in an injection context, or on `injector`.
 */
export function spielDetailsResource(
  spielId: () => SpielId | undefined,
  injector: Injector = inject(Injector)
): ResourceRef<SpielDetails | undefined> {
  return basketballDataResource(
    spielId,
    (data, spiel, signal) => data.spiel(spiel, { signal }),
    injector
  );
}
