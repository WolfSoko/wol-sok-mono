import {
  FullscreenOverlayContainer,
  OverlayContainer,
} from '@angular/cdk/overlay';
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';
import { providePwaUpdates } from './pwa-updates';

// Only used when the game runs on its own: inside the shell the remote's
// routes are loaded, not this config, so the service worker stays out of the
// shell's way.
export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideAnimations(),
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
    providePwaUpdates(),
    // Only the element that fills the screen is painted, so dialogs and
    // tooltips have to move into it while a page is fullscreen.
    { provide: OverlayContainer, useClass: FullscreenOverlayContainer },
  ],
};
