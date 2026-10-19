import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Analytics,
  getAnalytics,
  logEvent,
  provideAnalytics,
} from '@angular/fire/analytics';
import { FirebaseApp } from '@angular/fire/app';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Firebase Analytics for the GA4 property of the Firebase app (its
 * `measurementId`), browser only: AngularFire provides no instance on the
 * server. Disabled, nothing is provided, so `nx serve` and the e2e tests
 * (environment.develop) send no traffic.
 */
export function provideGoogleAnalytics(enabled: boolean): EnvironmentProviders {
  if (!enabled) {
    return makeEnvironmentProviders([]);
  }
  return makeEnvironmentProviders([
    provideAnalytics((injector) => getAnalytics(injector.get(FirebaseApp))),
    provideEnvironmentInitializer(trackScreenViews),
  ]);
}

/**
 * Logs a `screen_view` per navigation, as AngularFire's ScreenTrackingService
 * would. That service injects ComponentFactoryResolver, which Angular 22
 * removed, so it cannot be created here.
 */
function trackScreenViews(): void {
  const analytics: Analytics | null = inject(Analytics);
  if (!analytics) {
    return;
  }
  const title = inject(Title);
  inject(Router)
    .events.pipe(
      filter((event) => event instanceof NavigationEnd),
      takeUntilDestroyed()
    )
    .subscribe((event) => {
      logEvent(analytics, 'screen_view', {
        firebase_screen: event.urlAfterRedirects,
        firebase_screen_class: title.getTitle(),
      });
    });
}
