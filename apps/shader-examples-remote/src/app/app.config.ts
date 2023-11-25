import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { AuthModule } from '@wolsok/feat-api-auth';
import { provideDataAccess } from '@wolsok/shared-data-access';
import { Angulartics2Module } from 'angulartics2';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideRouter(appRoutes, withEnabledBlockingInitialNavigation()),
    provideDataAccess(environment.firebaseConfig),
    importProvidersFrom(AuthModule.forRoot(), Angulartics2Module.forRoot()),
  ],
};
