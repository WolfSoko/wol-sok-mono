import { inject, InjectionToken } from '@angular/core';
import type { Selection } from '@wolsok/feat-korbjaeger-selection';
import { KONTO_SITZUNG } from '../konto/konto';

/**
 * The screens' `Selection`: the device's, or the account's once signed in
 * (`KONTO_SITZUNG`); `teams` and `kinder` are `undefined` while it switches.
 */
export const AUSWAHL = new InjectionToken<Selection>('Auswahl', {
  providedIn: 'root',
  factory: () => inject(KONTO_SITZUNG).auswahl,
});
