import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { devTools } from '@ngneat/elf-devtools';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
    provideAppInitializer(() => {
      const initializerFn = initElfDevTools(inject(Actions));
      return initializerFn();
    }),
  ],
};

export function initElfDevTools(actions: Actions) {
  return () => {
    devTools({
      name: 'Fourier Analysis Remote App',
      actionsDispatcher: actions,
    });
  };
}
