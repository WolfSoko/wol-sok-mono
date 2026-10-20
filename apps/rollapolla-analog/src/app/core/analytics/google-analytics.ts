import {
  afterNextRender,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { getAnalytics, provideAnalytics } from '@angular/fire/analytics';
import { FirebaseApp } from '@angular/fire/app';
import { AnalyticsConsent } from './analytics-consent';
import { ConsentPrompt } from './consent';

/**
 * Firebase Analytics for the GA4 property of the Firebase app (its
 * `measurementId`), once the visitor consents. Page views, the first and those
 * on in-app navigation, come from GA4's enhanced measurement.
 */
export function provideGoogleAnalytics(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAnalytics((injector) => getAnalytics(injector.get(FirebaseApp))),
    AnalyticsConsent,
    { provide: ConsentPrompt, useExisting: AnalyticsConsent },
    // after the first render, so neither gtag.js nor the banner competes with
    // hydration
    provideEnvironmentInitializer(() => {
      const consent = inject(AnalyticsConsent);
      afterNextRender(() => consent.restore());
    }),
  ]);
}
