import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/** How long the first tap of a two-tap button waits for the second. */
export const ARMED_MS = 3_000;

/** A button that acts on its second tap only - "Give up", "Delete". */
export interface ArmedTap<K> {
  /** What the first tap armed - null while nothing waits. */
  readonly armed: Signal<K | null>;
  /**
   * Arms `key` for {@link ARMED_MS} - another key's tap arms that one
   * instead - or, when `key` waits already, disarms it and answers true:
   * the tap that acts.
   */
  tap(key: K): boolean;
}

/**
 * A two-tap button's state, its timer cleared with the component. Called
 * in an injection context.
 */
export function armedTap<K>(): ArmedTap<K> {
  const armed = signal<K | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  return {
    armed: armed.asReadonly(),
    tap: (key) => {
      clearTimeout(timer);
      if (armed() !== key) {
        armed.set(key);
        timer = setTimeout(() => armed.set(null), ARMED_MS);
        return false;
      }
      armed.set(null);
      return true;
    },
  };
}
