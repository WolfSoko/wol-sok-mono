import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { provideGoogleAnalytics } from './app/core/analytics/google-analytics';
import { provideAdSense } from './app/core/consent/ad-consent';
import { environment } from './environments/environment';

bootstrapApplication(
  AppComponent,
  mergeApplicationConfig(appConfig, {
    providers: [
      provideAnimations(),
      // browser only, so neither the analytics SDK nor the ad script reaches
      // the server bundle; not from `nx serve` and the e2e tests
      // (environment.develop). Each loads only with the visitor's consent.
      ...(environment.prod ? [provideGoogleAnalytics(), provideAdSense()] : []),
    ],
  })
).catch((err) => console.error(err));
