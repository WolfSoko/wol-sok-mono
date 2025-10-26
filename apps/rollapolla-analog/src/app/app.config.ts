import { provideFileRouter } from '@analogjs/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideDataAccess } from '@wolsok/shared-data-access';
import { environment } from '../environments/environment';
import { providePortsAndAdapter } from './provide-ports-and.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(),
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
