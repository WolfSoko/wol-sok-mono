import {
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  type Signal,
} from '@angular/core';

/**
 * `source`'s value once it stayed unchanged for `ms`, its first value at
 * once. Timed by `setTimeout` alone, never by the clock (RxJS's
 * `debounceTime` reads `Date.now`, and waits for ever where the clock
 * stands still). Created in an injection context.
 */
export function debounced<T>(source: Signal<T>, ms: number): Signal<T> {
  const settled = signal(untracked(source));
  let timer: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    const value = source();
    clearTimeout(timer);
    timer = setTimeout(() => settled.set(value), ms);
  });
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  return settled.asReadonly();
}
