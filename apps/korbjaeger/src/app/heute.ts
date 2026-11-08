import {
  DestroyRef,
  inject,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';

/** The DBB dates its Spiele by the German calendar day. */
const DEUTSCHER_KALENDERTAG = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The German calendar day of `moment`, `YYYY-MM-DD`, as the DBB's dates.
 * Built from the parts, since a locale's own date pattern may change.
 */
export function datumInDeutschland(moment: Date): string {
  const parts = DEUTSCHER_KALENDERTAG.formatToParts(moment);
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

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
