import { provideFileRouter } from '@analogjs/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection,
} from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideDataAccess } from '@wolsok/shared-data-access';
import { environment } from '../environments/environment';
import { providePortsAndAdapter } from './provide-ports-and.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideFileRouter(withEnabledBlockingInitialNavigation()),
    provideClientHydration(withIncrementalHydration(), withEventReplay()),
    provideHttpClient(withFetch()),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
    provideDataAccess(environment.dataAccessOptions, {
      emulated: !environment.prod,
      host: 'localhost',
      port: 8080,
    }),
    providePortsAndAdapter(),
  ],
};
