import { provideFileRouter } from '@analogjs/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideClientHydration } from '@angular/platform-browser';
import { withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideDataAccess } from '@wolsok/shared-data-access';
import { providePortsAndAdapter } from './provide-ports-and.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFileRouter(withEnabledBlockingInitialNavigation()),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    provideDataAccess(),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
    providePortsAndAdapter(),
  ],
};
