import {
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';
import { datumInDeutschland } from '@wolsok/feat-shared-basketball-data';

/**
 * Today's German date, `YYYY-MM-DD`, as a Spiel's `datum`. Read at start
 * and again whenever the page's visibility changes, so a tablet left open
 * overnight shows the new day once woken. Specs provide a fixed day.
 */
export const HEUTE = new InjectionToken<Signal<string>>('HEUTE', {
  providedIn: 'root',
  factory: () => {
    const heute = signal(datumInDeutschland(new Date()));
    const document = inject(DOCUMENT);
    // on hiding too: cheaper than asking which way it changed
    const neuLesen = (): void => heute.set(datumInDeutschland(new Date()));
    document.addEventListener('visibilitychange', neuLesen);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('visibilitychange', neuLesen)
    );
    return heute.asReadonly();
  },
});
