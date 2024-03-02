import {
  APP_INITIALIZER,
  ApplicationConfig,
  ApplicationRef,
  ViewEncapsulation,
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
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initElfDevTools,
      deps: [Actions],
    },
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
