import {
  afterNextRender,
  EnvironmentProviders,
  inject,
  Injector,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  Analytics,
  getAnalytics,
  provideAnalytics,
} from '@angular/fire/analytics';
import { FirebaseApp } from '@angular/fire/app';

/**
 * Firebase Analytics for the GA4 property of the Firebase app (its
 * `measurementId`). Page views, the first and those on in-app navigation,
 * come from GA4's enhanced measurement. Disabled, nothing is provided, so
 * `nx serve` and the e2e tests (environment.develop) send no traffic.
 */
export function provideGoogleAnalytics(enabled: boolean): EnvironmentProviders {
  if (!enabled) {
    return makeEnvironmentProviders([]);
  }
  return makeEnvironmentProviders([
    provideAnalytics((injector) => getAnalytics(injector.get(FirebaseApp))),
    // AngularFire creates the instance (and loads gtag.js) on first injection:
    // in the browser, after the first render so it does not compete with
    // hydration. On the server it provides no instance.
    provideEnvironmentInitializer(() => {
      const injector = inject(Injector);
      afterNextRender(() => injector.get(Analytics));
    }),
  ]);
}
