import { signal, type ResourceStatus } from '@angular/core';
import type { DatenResource } from '../app/basketball-data/basketball-data-resource';
import type { Stand } from '../app/basketball-data/stand';

/** What a fake read shows: its status, and its value, error or `Stand`. */
export interface FakeLesung<T> {
  readonly status: ResourceStatus;
  readonly value?: T;
  readonly error?: Error;
  readonly stand?: Stand;
}

/**
 * A `DatenResource` that only shows `lesung`, for specs of pure functions
 * over reads: `hasValue` as Angular's (a value, and no error), `isLoading`
 * while `loading` or `reloading`; `reload` and `destroy` do nothing.
 */
export function fakeDatenResource<T>({
  status,
  value,
  error,
  stand,
}: FakeLesung<T>): DatenResource<T | undefined> {
  const hasValue = (): boolean => status !== 'error' && value !== undefined;
  const fake = {
    value: signal(value),
    status: signal(status),
    error: signal(error),
    isLoading: signal(status === 'loading' || status === 'reloading'),
    snapshot: signal(
      status === 'error'
        ? { status, error: error ?? new Error('rejected') }
        : { status, value }
    ),
    stand: signal(stand),
    hasValue,
    reload: () => false,
    destroy: () => undefined,
  };
  // the type predicate of `hasValue` has no implementation but a boolean
  return fake as unknown as DatenResource<T | undefined>;
}
