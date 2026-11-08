import {
  DestroyRef,
  inject,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';
import { datumInDeutschland } from '@wolsok/feat-shared-basketball-data';

const STUNDE = 3_600_000;

/** Germany's offsets from UTC, summer time first. */
const DEUTSCHE_UTC_OFFSETS = [2 * STUNDE, STUNDE] as const;

/**
 * How long from `moment` to the next German midnight: 00:00 of the next
 * German day is UTC midnight less summer or winter time's offset, whichever
 * already falls on that day.
 */
export function msBisMorgen(moment: Date): number {
  const [jahr, monat, tag] = datumInDeutschland(moment).split('-').map(Number);
  const utcMorgen = Date.UTC(jahr, monat - 1, tag + 1);
  const morgen = datumInDeutschland(new Date(utcMorgen));
  const mitternacht =
    DEUTSCHE_UTC_OFFSETS.map((offset) => utcMorgen - offset).find(
      (kandidat) => datumInDeutschland(new Date(kandidat)) === morgen
    ) ?? utcMorgen;
  return mitternacht - moment.getTime();
}

/**
 * Today's German date, `YYYY-MM-DD`, turning at German midnight: one timer
 * waits for the next one and is cleared with the app. Specs provide a
 * fixed day.
 */
export const HEUTE = new InjectionToken<Signal<string>>('HEUTE', {
  providedIn: 'root',
  factory: () => {
    const heute = signal(datumInDeutschland(new Date()));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bisMorgen = (): void => {
      timer = setTimeout(() => {
        heute.set(datumInDeutschland(new Date()));
        bisMorgen();
      }, msBisMorgen(new Date()));
    };
    bisMorgen();
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    return heute.asReadonly();
  },
});
