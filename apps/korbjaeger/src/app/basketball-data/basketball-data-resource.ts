import {
  computed,
  inject,
  Injector,
  resource,
  signal,
  type Resource,
  type ResourceRef,
  type ResourceSnapshot,
  type ResourceStatus,
  type Signal,
} from '@angular/core';
import {
  BASKETBALL_DATA,
  type KorbjaegerData,
} from './basketball-data.provider';
import { Lesung, type KorbReadOptions } from './lesung';
import type { Stand } from './stand';

/**
 * A read's resource, with the `Stand` of its value: `undefined` while the
 * value was just read, else when its last good answer came and why it was
 * shown instead (`korb-stand` shows it).
 */
export interface DatenResource<T> extends Resource<T> {
  readonly stand: Signal<Stand | undefined>;
  hasValue(
    this: T extends undefined ? this : never
  ): this is DatenResource<Exclude<T, undefined>>;
  hasValue(): boolean;
  /** Reads again; see `ResourceRef.reload`. */
  reload(): boolean;
  /** Cancels the read and drops it; see `ResourceRef.destroy`. */
  destroy(): void;
}

/** A `DatenResource` over Angular's `resource`, with a `stand` of its own. */
class LesendeResource<T> implements DatenResource<T> {
  public readonly value: Signal<T>;
  public readonly status: Signal<ResourceStatus>;
  public readonly error: Signal<Error | undefined>;
  public readonly isLoading: Signal<boolean>;
  public readonly snapshot: Signal<ResourceSnapshot<T>>;
  public readonly stand: Signal<Stand | undefined>;

  public constructor(
    private readonly ref: ResourceRef<T>,
    gelesenerStand: Signal<Stand | undefined>
  ) {
    this.value = ref.value.asReadonly();
    this.status = ref.status;
    this.error = ref.error;
    this.isLoading = ref.isLoading;
    this.snapshot = ref.snapshot;
    // a Stand belongs to the value it came with
    this.stand = computed(() =>
      ref.hasValue() ? gelesenerStand() : undefined
    );
  }

  public hasValue(
    this: T extends undefined ? this : never
  ): this is DatenResource<Exclude<T, undefined>>;
  public hasValue(): boolean;
  public hasValue(): boolean {
    return this.ref.hasValue();
  }

  public reload(): boolean {
    return this.ref.reload();
  }

  public destroy(): void {
    this.ref.destroy();
  }
}

/**
 * A resource making one read of `BASKETBALL_DATA` for the params `params`
 * gives, none while it gives none; new params cancel the read of the last
 * (`options.signal`). Each load is one `Lesung`: the answers the read
 * mapped are kept as its last good ones, and where the transport answered
 * from those instead, `stand` says so; a load that starts clears it.
 * Created in an injection context, or on `injector`.
 */
export function basketballDataResource<P, T>(
  params: () => P | undefined,
  read: (
    data: KorbjaegerData,
    params: P,
    options: KorbReadOptions
  ) => Promise<T>,
  injector: Injector = inject(Injector)
): DatenResource<T | undefined> {
  const data = injector.get(BASKETBALL_DATA);
  const gelesenerStand = signal<Stand | undefined>(undefined);
  const ref = resource({
    params,
    loader: async ({ params: gegeben, abortSignal }) => {
      gelesenerStand.set(undefined);
      const lesung = new Lesung();
      const wert = await read(data, gegeben, {
        signal: abortSignal,
        lesung,
      });
      if (!abortSignal.aborted) {
        lesung.abschliessen();
        gelesenerStand.set(lesung.stand);
      }
      return wert;
    },
    injector,
  });
  return new LesendeResource(ref, gelesenerStand);
}
