import { InjectionToken } from '@angular/core';

/** The DBB dates its Spiele by the German calendar day. */
const DEUTSCHES_DATUM = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The German calendar day of `moment`, `YYYY-MM-DD`, as the DBB's dates. */
export function datumInDeutschland(moment: Date): string {
  return DEUTSCHES_DATUM.format(moment);
}

/** Today's German date, `YYYY-MM-DD`; specs provide a fixed day. */
export const HEUTE = new InjectionToken<() => string>('HEUTE', {
  providedIn: 'root',
  factory: () => () => datumInDeutschland(new Date()),
});
