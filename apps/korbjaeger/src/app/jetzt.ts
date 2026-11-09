import {
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';

/** How often the clock moves on while the page stays in view. */
const TAKT_MS = 60_000;

/**
 * The time, in ms since the epoch: read at start, every minute and again
 * whenever the page's visibility changes, so a tablet left open overnight
 * shows the right time and day once woken. The one clock of the screens
 * (`HEUTE` is its German date); specs provide a fixed time.
 */
export const JETZT = new InjectionToken<Signal<number>>('JETZT', {
  providedIn: 'root',
  factory: () => {
    const jetzt = signal(Date.now());
    const document = inject(DOCUMENT);
    // on hiding too: cheaper than asking which way it changed
    const neuLesen = (): void => jetzt.set(Date.now());
    document.addEventListener('visibilitychange', neuLesen);
    const takt = setInterval(neuLesen, TAKT_MS);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', neuLesen);
      clearInterval(takt);
    });
    return jetzt.asReadonly();
  },
});
