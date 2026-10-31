import {
  DestroyRef,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { provideFirebaseAnalytics } from '@wolsok/shared-analytics';
import { distinctUntilChanged, map } from 'rxjs';
import { Account, isGoogleAccount } from '../../../shared/account';
import { AccountPort } from '../../ports/account.port';
import { injectRollaPollaAnalytics } from './rollapolla-analytics';

export const CONSENT_STORAGE_KEY = 'rap-analytics-consent';

/**
 * Firebase Analytics for the GA4 property of the Firebase app (its
 * `measurementId`), once the visitor consents: page views and the events of
 * `RollaPollaEvents`, with the kind of account as a user property.
 */
export function provideGoogleAnalytics(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideFirebaseAnalytics({
      storageKey: CONSENT_STORAGE_KEY,
      app: () => inject(FirebaseApp),
    }),
    provideEnvironmentInitializer(reportAccountKind),
  ]);
}

export type AccountKind = 'none' | 'anonymous' | 'google';

export function accountKind(account: Account | null): AccountKind {
  if (account === null) return 'none';
  return isGoogleAccount(account) ? 'google' : 'anonymous';
}

function reportAccountKind(): void {
  const analytics = injectRollaPollaAnalytics();
  const subscription = inject(AccountPort)
    .account$.pipe(map(accountKind), distinctUntilChanged())
    .subscribe((account) => analytics.setUserProperties({ account }));
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
}
