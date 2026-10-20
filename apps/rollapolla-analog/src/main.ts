import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { provideGoogleAnalytics } from './app/core/analytics/google-analytics';
import { environment } from './environments/environment';

bootstrapApplication(
  AppComponent,
  mergeApplicationConfig(appConfig, {
    providers: [
      provideAnimations(),
      // browser only, so the analytics SDK stays out of the server bundle;
      // not from `nx serve` and the e2e tests (environment.develop)
      ...(environment.prod ? [provideGoogleAnalytics()] : []),
    ],
  })
).catch((err) => console.error(err));
