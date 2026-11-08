import { computed, inject, InjectionToken, type Signal } from '@angular/core';
import { datumInDeutschland } from '@wolsok/feat-shared-basketball-data';
import { JETZT } from './jetzt';

/**
 * Today's German date, `YYYY-MM-DD`, as a Spiel's `datum`: the date of
 * `JETZT`, so it turns with the clock and once a page left open overnight
 * comes back into view. Specs provide a fixed day.
 */
export const HEUTE = new InjectionToken<Signal<string>>('HEUTE', {
  providedIn: 'root',
  factory: () => {
    const jetzt = inject(JETZT);
    return computed(() => datumInDeutschland(new Date(jetzt())));
  },
});
