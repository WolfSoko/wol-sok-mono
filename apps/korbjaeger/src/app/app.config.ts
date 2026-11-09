import { provideFileRouter } from '@analogjs/router';
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { withComponentInputBinding } from '@angular/router';
import { provideBasketballData } from './basketball-data/basketball-data.provider';
import { provideAppServiceWorker } from './pwa/app-service-worker';
import { provideInstallationsHinweis } from './pwa/installations-hinweis';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(withComponentInputBinding()),
    provideBasketballData(),
    provideAppServiceWorker(),
    provideInstallationsHinweis(),
  ],
};
