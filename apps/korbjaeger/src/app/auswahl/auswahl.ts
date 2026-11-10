import { inject, InjectionToken } from '@angular/core';
import type { Auswahl } from '@wolsok/feat-korbjaeger-auswahl';
import { KONTO_SITZUNG } from '../konto/konto';

/**
 * The screens' `Auswahl`: the device's, or the account's once signed in
 * (`KONTO_SITZUNG`); `teams` and `kinder` are `undefined` while it switches.
 */
export const AUSWAHL = new InjectionToken<Auswahl>('Auswahl', {
  providedIn: 'root',
  factory: () => inject(KONTO_SITZUNG).auswahl,
});
