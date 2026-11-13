import { computed, inject, InjectionToken, type Signal } from '@angular/core';
import { dateInGermany } from '@wolsok/feat-shared-basketball-data';
import { NOW } from './now';

/**
 * Today's German date, `YYYY-MM-DD`, as a Spiel's `datum`: the date of
 * `NOW`, so it turns with the clock and once a page left open overnight
 * comes back into view. Specs provide a fixed day.
 */
export const TODAY = new InjectionToken<Signal<string>>('TODAY', {
  providedIn: 'root',
  factory: () => {
    const now = inject(NOW);
    return computed(() => dateInGermany(new Date(now())));
  },
});
