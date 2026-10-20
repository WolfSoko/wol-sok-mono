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
 * come from GA4's enhanced measurement.
 */
export function provideGoogleAnalytics(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAnalytics((injector) => getAnalytics(injector.get(FirebaseApp))),
    // AngularFire creates the instance (and loads gtag.js) on first injection,
    // after the first render so it does not compete with hydration
    provideEnvironmentInitializer(() => {
      const injector = inject(Injector);
      afterNextRender(() => injector.get(Analytics));
    }),
  ]);
}
