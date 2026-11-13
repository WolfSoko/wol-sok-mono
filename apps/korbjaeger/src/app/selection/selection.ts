import { inject, InjectionToken } from '@angular/core';
import type { Selection } from '@wolsok/feat-korbjaeger-selection';
import { ACCOUNT_SESSION } from '../account/account';

/**
 * The screens' `Selection`: the device's, or the account's once signed in
 * (`ACCOUNT_SESSION`); `teams` and `children` are `undefined` while it switches.
 */
export const SELECTION = new InjectionToken<Selection>('Auswahl', {
  providedIn: 'root',
  factory: () => inject(ACCOUNT_SESSION).selection,
});
