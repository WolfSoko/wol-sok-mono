import { provideHttpClient } from '@angular/common/http';
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { enableAkitaProdMode } from '@datorama/akita';
import {
  browserTracingIntegration,
  init,
  replayIntegration,
} from '@sentry/angular-ivy';
import { provideWsThanosOptions } from '@wolsok/thanos';
import { provideAppRouter } from './app/app-routing';
import { AppComponent } from './app/app.component';
import { provideCore } from './app/core/core.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

init({
  dsn: 'https://d7eab9a5f3484e48b3cf9c110533dcbe@o1384048.ingest.sentry.io/6702682',
  release: `angular-examples@${environment.version}`,
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  // eslint-disable-next-line no-magic-numbers
  replaysSessionSampleRate: 1,

  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  integrations: [replayIntegration(), browserTracingIntegration()],
  tracePropagationTargets: ['https://angularexamples.wolsok.de/'],
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

bootstrapApplication(AppComponent, {
  providers: [
    provideAppRouter(),
    provideHttpClient(),
    provideCore(),
    [
      provideWsThanosOptions({
        maxParticleCount: 50000,
        animationLength: 5000,
      }),
    ],
  ],
}).catch((err) => console.error(err));
