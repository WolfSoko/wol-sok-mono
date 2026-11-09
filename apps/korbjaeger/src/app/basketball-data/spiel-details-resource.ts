import { inject, Injector } from '@angular/core';
import type {
  SpielDetails,
  SpielId,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from './basketball-data-resource';

/**
 * A resource reading the details (result, quarters, Halle) of the Spiel
 * `spielId` gives, none while it gives none; a new id cancels the read of
 * the last. Created in an injection context, or on `injector`.
 */
export function spielDetailsResource(
  spielId: () => SpielId | undefined,
  injector: Injector = inject(Injector)
): DatenResource<SpielDetails | undefined> {
  return basketballDataResource(
    spielId,
    (data, spiel, options) => data.spiel(spiel, options),
    injector
  );
}
