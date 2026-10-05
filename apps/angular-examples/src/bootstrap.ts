import {
  FullscreenOverlayContainer,
  OverlayContainer,
} from '@angular/cdk/overlay';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { enableProdMode, provideZonelessChangeDetection } from '@angular/core';
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

/** every pixel even of large elements, but only where the device has the memory for it */
function thanosParticleCount(): { maxParticleCount?: number } {
  const deviceMemoryGb = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  return deviceMemoryGb != null && deviceMemoryGb >= 8
    ? { maxParticleCount: 6_000_000 }
    : {};
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideAppRouter(),
    provideHttpClient(withFetch()),
    provideCore(),
    [
      provideWsThanosOptions({
        animationLength: 5000,
        ...thanosParticleCount(),
      }),
    ],
    // Only the element that fills the screen is painted, so dialogs and
    // tooltips have to move into it while a page is fullscreen.
    { provide: OverlayContainer, useClass: FullscreenOverlayContainer },
  ],
}).catch((err) => console.error(err));
