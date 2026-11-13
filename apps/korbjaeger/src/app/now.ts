import {
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';

/** How often the clock moves on while the page stays in view. */
const TICK_MS = 60_000;

/**
 * The time, in ms since the epoch: read at start, every minute and again
 * whenever the page's visibility changes, so a tablet left open overnight
 * shows the right time and day once woken. The one clock of the screens
 * (`TODAY` is its German date); specs provide a fixed time.
 */
export const NOW = new InjectionToken<Signal<number>>('NOW', {
  providedIn: 'root',
  factory: () => {
    const now = signal(Date.now());
    const document = inject(DOCUMENT);
    // on hiding too: cheaper than asking which way it changed
    const reread = (): void => now.set(Date.now());
    document.addEventListener('visibilitychange', reread);
    const tick = setInterval(reread, TICK_MS);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', reread);
      clearInterval(tick);
    });
    return now.asReadonly();
  },
});
