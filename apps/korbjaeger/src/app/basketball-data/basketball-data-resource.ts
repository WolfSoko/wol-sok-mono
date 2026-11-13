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
import { Reading, type KorbReadOptions } from './reading';
import type { AsOf } from './as-of';

/**
 * A read's resource, with the `AsOf` of its value: `undefined` while the
 * value was just read, else when its last good answer came and why it was
 * shown instead (`korb-as-of` shows it).
 */
export interface DataResource<T> extends Resource<T> {
  readonly asOf: Signal<AsOf | undefined>;
  hasValue(
    this: T extends undefined ? this : never
  ): this is DataResource<Exclude<T, undefined>>;
  hasValue(): boolean;
  /** Reads again; see `ResourceRef.reload`. */
  reload(): boolean;
  /** Cancels the read and drops it; see `ResourceRef.destroy`. */
  destroy(): void;
}

/** A `DataResource` over Angular's `resource`, with an `asOf` of its own. */
class ReadingResource<T> implements DataResource<T> {
  public readonly value: Signal<T>;
  public readonly status: Signal<ResourceStatus>;
  public readonly error: Signal<Error | undefined>;
  public readonly isLoading: Signal<boolean>;
  public readonly snapshot: Signal<ResourceSnapshot<T>>;
  public readonly asOf: Signal<AsOf | undefined>;

  public constructor(
    private readonly ref: ResourceRef<T>,
    readAsOf: Signal<AsOf | undefined>
  ) {
    this.value = ref.value.asReadonly();
    this.status = ref.status;
    this.error = ref.error;
    this.isLoading = ref.isLoading;
    this.snapshot = ref.snapshot;
    // a Stand belongs to the value it came with
    this.asOf = computed(() => (ref.hasValue() ? readAsOf() : undefined));
  }

  public hasValue(
    this: T extends undefined ? this : never
  ): this is DataResource<Exclude<T, undefined>>;
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
 * (`options.signal`). Each load is one `Reading`: the answers the read
 * mapped are kept as its last good ones, and where the transport answered
 * from those instead, `asOf` says so; it changes with the value, once a
 * load has its own, so a value shown while reloading keeps its Stand.
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
): DataResource<T | undefined> {
  const data = injector.get(BASKETBALL_DATA);
  const readAsOf = signal<AsOf | undefined>(undefined);
  const ref = resource({
    params,
    loader: async ({ params: given, abortSignal }) => {
      const reading = new Reading();
      const value = await read(data, given, {
        signal: abortSignal,
        reading,
      });
      if (!abortSignal.aborted) {
        reading.complete();
        // with the value it belongs to: the old one keeps its Stand while
        // it still shows, reloading
        readAsOf.set(reading.asOf);
      }
      return value;
    },
    injector,
  });
  return new ReadingResource(ref, readAsOf);
}
