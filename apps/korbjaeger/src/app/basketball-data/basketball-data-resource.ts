import {
  computed,
  inject,
  Injector,
  resource,
  signal,
  type ResourceRef,
  type Signal,
} from '@angular/core';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from './basketball-data.provider';
import { aelterer, type Stand, type StandReadOptions } from './stand';

/**
 * A read's resource, with the `Stand` of its value: `undefined` while the
 * value was just read, else when its last good answer came and why it was
 * shown instead (`korb-stand` shows it).
 */
export interface DatenResource<T> extends ResourceRef<T> {
  readonly stand: Signal<Stand | undefined>;
  hasValue(): this is DatenResource<Exclude<T, undefined>>;
}

/**
 * A resource making one read of `BASKETBALL_DATA` for the params `params`
 * gives, none while it gives none; new params cancel the read of the last
 * (`options.signal`). `read` hands `options` to the read as they are, so
 * the transport can tell of a last good answer (`stand`). Created in an
 * injection context, or on `injector`.
 */
export function basketballDataResource<P, T>(
  params: () => P | undefined,
  read: (
    data: KorbjaegerData,
    params: P,
    options: StandReadOptions
  ) => Promise<T>,
  injector: Injector = inject(Injector)
): DatenResource<T | undefined> {
  const data = injector.get(BASKETBALL_DATA);
  const gelesenerStand = signal<Stand | undefined>(undefined);
  const ref = resource({
    params,
    loader: async ({ params: gegeben, abortSignal }) => {
      let stand: Stand | undefined;
      const wert = await read(data, gegeben, {
        signal: abortSignal,
        beiStand: (gemeldet) => {
          stand = aelterer(stand, gemeldet);
        },
      });
      if (!abortSignal.aborted) {
        gelesenerStand.set(stand);
      }
      return wert;
    },
    injector,
  });
  // the same object with its `stand`: `hasValue` narrows it, `stand` too
  return Object.assign(ref, {
    stand: computed(() => (ref.hasValue() ? gelesenerStand() : undefined)),
  }) as DatenResource<T | undefined>;
}
