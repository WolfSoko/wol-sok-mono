import { APP_INITIALIZER, EnvironmentProviders, ErrorHandler, importProvidersFrom, Provider } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import * as Sentry from '@sentry/angular-ivy';
import { AuthModule } from '@wolsok/feat-api-auth';
import { Angulartics2Module } from 'angulartics2';
import { environment } from '../../environments/environment';

export const provideCore: () => Array<Provider | EnvironmentProviders> = () => [
  provideAnimations(),
  provideServiceWorker('ngsw-worker.js', {
    enabled: environment.production,
  }),
  importProvidersFrom(
    AkitaNgDevtools.forRoot(),
    AkitaNgRouterStoreModule,
    MatSnackBarModule,
    Angulartics2Module.forRoot(),
    AuthModule.forRoot(environment.firebaseConfig)
  ),
  {
    provide: ErrorHandler,
    useValue: Sentry.createErrorHandler({
      showDialog: true,
    }),
  },
  {
    provide: Sentry.TraceService,
    deps: [Router],
  },
  {
    provide: APP_INITIALIZER,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    useFactory: () => () => {},
    deps: [Sentry.TraceService],
    multi: true,
  },
];
