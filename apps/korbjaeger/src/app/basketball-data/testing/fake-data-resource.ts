import {
  signal,
  type ResourceSnapshot,
  type ResourceStatus,
  type Signal,
} from '@angular/core';
import type { DataResource } from '../basketball-data-resource';
import type { AsOf } from '../as-of';

/** What a fake read shows: its status, and its value, error or `AsOf`. */
export interface FakeReading<T> {
  readonly status: ResourceStatus;
  readonly value?: T;
  readonly error?: Error;
  readonly asOf?: AsOf;
}

/**
 * A `DataResource` that only shows a `FakeReading`, for specs of pure
 * functions over reads: `hasValue` and `isLoading` from its snapshot, as
 * Angular's resources tell them; `reload` and `destroy` do nothing.
 */
export class FakeDataResource<T> implements DataResource<T | undefined> {
  public readonly value: Signal<T | undefined>;
  public readonly status: Signal<ResourceStatus>;
  public readonly error: Signal<Error | undefined>;
  public readonly isLoading: Signal<boolean>;
  public readonly snapshot: Signal<ResourceSnapshot<T | undefined>>;
  public readonly asOf: Signal<AsOf | undefined>;

  public constructor({ status, value, error, asOf }: FakeReading<T>) {
    this.value = signal(value);
    this.status = signal(status);
    this.error = signal(error);
    this.isLoading = signal(status === 'loading' || status === 'reloading');
    this.snapshot = signal(
      status === 'error'
        ? { status, error: error ?? new Error('rejected') }
        : { status, value }
    );
    this.asOf = signal(asOf);
  }

  public hasValue(
    this: T | undefined extends undefined ? this : never
  ): this is DataResource<Exclude<T | undefined, undefined>>;
  public hasValue(): boolean;
  public hasValue(): boolean {
    return this.status() !== 'error' && this.value() !== undefined;
  }

  public reload(): boolean {
    return false;
  }

  public destroy(): void {
    // nothing to cancel
  }
}
