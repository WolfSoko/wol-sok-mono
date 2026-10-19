import { provideFileRouter } from '@analogjs/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import {
  provideClientHydration,
  withEventReplay,
  withIncrementalHydration,
} from '@angular/platform-browser';
import { provideDataAccess } from '@wolsok/shared-data-access';
import { environment } from '../environments/environment';
import { provideGoogleAnalytics } from './core/analytics/google-analytics';
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
    provideAuth((injector) => {
      const auth = getAuth(injector.get(FirebaseApp));
      if (!environment.prod) {
        connectAuthEmulator(auth, 'http://localhost:9099', {
          disableWarnings: true,
        });
      }
      return auth;
    }),
    providePortsAndAdapter(),
    provideGoogleAnalytics(environment.googleAnalyticsMeasurementId),
  ],
};
