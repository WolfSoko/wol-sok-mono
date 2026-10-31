import {
  afterNextRender,
  DestroyRef,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Analytics } from './analytics';
import { ConsentPrompt } from './consent';
import {
  FIREBASE_ANALYTICS_OPTIONS,
  FirebaseAnalytics,
  FirebaseAnalyticsOptions,
} from './firebase-analytics';
import { routePattern, urlPath } from './route-pattern';

/**
 * Firebase Analytics for the GA4 property of a Firebase app (its
 * `measurementId`), once the visitor consents: a page view for each route
 * the router shows, and the events the app tracks through `Analytics`. The
 * app asks for consent itself, with `ConsentPrompt`. Browser only: an SSR
 * app adds it in `main.ts`, not in the server's config.
 */
export function provideFirebaseAnalytics(
  options: FirebaseAnalyticsOptions
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: FIREBASE_ANALYTICS_OPTIONS, useValue: options },
    FirebaseAnalytics,
    { provide: ConsentPrompt, useExisting: FirebaseAnalytics },
    { provide: Analytics, useExisting: FirebaseAnalytics },
    provideEnvironmentInitializer(() => {
      const analytics = inject(FirebaseAnalytics);
      trackPageViews(analytics);
      // after the first render, so neither a consent banner nor gtag.js
      // competes with hydration
      afterNextRender(() => analytics.restore());
    }),
  ]);
}

/**
 * One page view per path the router lands on. A change of only the query or
 * the hash (a search field that keeps its text in the URL) counts as none.
 */
function trackPageViews(analytics: FirebaseAnalytics): void {
  const router = inject(Router, { optional: true });
  if (!router) return;
  let shownPath: string | null = null;
  const subscription = router.events.subscribe((event) => {
    if (!(event instanceof NavigationEnd)) return;
    const path = urlPath(event.urlAfterRedirects);
    if (path === shownPath) return;
    shownPath = path;
    analytics.pageView(routePattern(router.routerState.snapshot.root));
  });
  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
}
