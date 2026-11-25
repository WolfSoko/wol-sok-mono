import {
  FullscreenOverlayContainer,
  OverlayContainer,
} from '@angular/cdk/overlay';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { enableProdMode, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { enableAkitaProdMode } from '@datorama/akita';
import { reportError, startErrorReports } from '@wolsok/shared-error-reports';
import { provideWsThanosOptions } from '@wolsok/thanos';
import { provideAppRouter } from './app/app-routing';
import { AppComponent } from './app/app.component';
import { provideCore } from './app/core/core.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

// Before Angular, so a failing start is reported too; the SDK loads beside
// the start, not before it.
startErrorReports(environment.sentry);

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
}).catch((err) => {
  console.error(err);
  reportError(err);
});
