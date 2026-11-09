import { provideFileRouter } from '@analogjs/router';
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  withComponentInputBinding,
  withInMemoryScrolling,
} from '@angular/router';
import { provideBasketballData } from './basketball-data/basketball-data.provider';
import { provideAppServiceWorker } from './pwa/app-service-worker';
import { provideInstallationsHinweis } from './pwa/installations-hinweis';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(
      withComponentInputBinding(),
      // a link at a page's foot (the footer's) opens the next at its top;
      // back returns to the position where the page is there already, not
      // to one its data still has to fill
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    ),
    provideBasketballData(),
    provideAppServiceWorker(),
    provideInstallationsHinweis(),
  ],
};
