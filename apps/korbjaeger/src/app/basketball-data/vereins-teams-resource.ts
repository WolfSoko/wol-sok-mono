import { inject, Injector } from '@angular/core';
import type {
  VereinId,
  VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from './basketball-data-resource';

/**
 * A resource reading the Teams of the Verein `vereinId` gives, as its
 * recent Spiele show them, none while it gives none; a new id cancels the
 * read of the last. Created in an injection context, or on `injector`.
 */
export function vereinsTeamsResource(
  vereinId: () => VereinId | undefined,
  injector: Injector = inject(Injector)
): DatenResource<VereinsTeams | undefined> {
  return basketballDataResource(
    vereinId,
    (data, verein, options) => data.vereinsTeams(verein, options),
    injector
  );
}
