import {
  APP_INITIALIZER,
  EnvironmentProviders,
  ErrorHandler,
  importProvidersFrom,
  Provider,
} from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { createErrorHandler, TraceService } from '@sentry/angular-ivy';
import { AuthModule } from '@wolsok/feat-api-auth';
import { provideDataAccess } from '@wolsok/shared-data-access';
import { Angulartics2Module } from 'angulartics2';
import { environment } from '../../environments/environment';

export const provideCore: () => Array<Provider | EnvironmentProviders> = () => [
  provideAnimations(),
  provideServiceWorker('ngsw-worker.js', {
    enabled: environment.production,
  }),
  provideDataAccess(environment.firebaseConfig),
  importProvidersFrom(
    AkitaNgDevtools.forRoot(),
    AkitaNgRouterStoreModule,
    MatSnackBarModule,
    Angulartics2Module.forRoot(),
    AuthModule.forRoot()
  ),
  {
    provide: ErrorHandler,
    useValue: createErrorHandler({
      showDialog: true,
    }),
  },
  {
    provide: TraceService,
    deps: [Router],
  },
  {
    provide: APP_INITIALIZER,
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    useFactory: () => () => {},
    deps: [TraceService],
    multi: true,
  },
];
