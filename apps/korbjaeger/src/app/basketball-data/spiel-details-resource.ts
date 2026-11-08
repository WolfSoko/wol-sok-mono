import { inject, Injector, resource, type ResourceRef } from '@angular/core';
import type {
  SpielDetails,
  SpielId,
} from '@wolsok/feat-shared-basketball-data';
import { BASKETBALL_DATA } from './basketball-data.provider';

/**
 * A resource reading the details (result, quarters, Halle) of the Spiel
 * `spielId` gives, none while it gives none; a new id cancels the read of
 * the last. Created in an injection context, or on `injector`.
 */
export function spielDetailsResource(
  spielId: () => SpielId | undefined,
  injector: Injector = inject(Injector)
): ResourceRef<SpielDetails | undefined> {
  const data = injector.get(BASKETBALL_DATA);
  return resource({
    params: spielId,
    loader: ({ params, abortSignal }) =>
      data.spiel(params, { signal: abortSignal }),
    injector,
  });
}
