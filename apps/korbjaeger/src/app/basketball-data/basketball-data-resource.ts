import { inject, Injector, resource, type ResourceRef } from '@angular/core';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from './basketball-data.provider';

/**
 * A resource making one read of `BASKETBALL_DATA` for the params `params`
 * gives, none while it gives none; new params cancel the read of the last
 * (`signal`). Created in an injection context, or on `injector`.
 */
export function basketballDataResource<P, T>(
  params: () => P | undefined,
  read: (data: KorbjaegerData, params: P, signal: AbortSignal) => Promise<T>,
  injector: Injector = inject(Injector)
): ResourceRef<T | undefined> {
  const data = injector.get(BASKETBALL_DATA);
  return resource({
    params,
    loader: ({ params: gegeben, abortSignal }) =>
      read(data, gegeben, abortSignal),
    injector,
  });
}
