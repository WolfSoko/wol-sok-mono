import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTheme } from '@wolsok/shared-theme';
import { appRoutes } from './app.routes';
import { PORTFOLIO_THEME } from './theme/theme';
import {
  provideClientHydration,
  withEventReplay,
} from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withEventReplay()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideTheme(PORTFOLIO_THEME),
  ],
};
