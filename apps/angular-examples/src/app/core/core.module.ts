import {
  EnvironmentProviders,
  importProvidersFrom,
  Provider,
} from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { AkitaNgRouterStoreModule } from '@datorama/akita-ng-router-store';
import { AkitaNgDevtools } from '@datorama/akita-ngdevtools';
import { AuthModule } from '@wolsok/feat-api-auth';
import { provideDataAccess } from '@wolsok/shared-data-access';
import { provideErrorReports } from '@wolsok/shared-error-reports';
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
  // Angular's errors to Sentry, from the production build only.
  provideErrorReports(environment.sentry),
];
