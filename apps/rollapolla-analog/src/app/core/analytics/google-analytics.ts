import {
  afterNextRender,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { AnalyticsConsent } from './analytics-consent';
import { ConsentPrompt } from './consent';

/**
 * Firebase Analytics for the GA4 property of the Firebase app (its
 * `measurementId`), once the visitor consents. Page views, the first and those
 * on in-app navigation, come from GA4's enhanced measurement.
 */
export function provideGoogleAnalytics(): EnvironmentProviders {
  return makeEnvironmentProviders([
    AnalyticsConsent,
    { provide: ConsentPrompt, useExisting: AnalyticsConsent },
    // after the first render, so neither the banner nor gtag.js competes with
    // hydration
    provideEnvironmentInitializer(() => {
      const consent = inject(AnalyticsConsent);
      afterNextRender(() => consent.restore());
    }),
  ]);
}
