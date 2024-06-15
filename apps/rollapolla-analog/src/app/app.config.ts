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
    provideDataAccess({
      apiKey: 'AIzaSyC_xYS5_BoMPyqn3sdMQ_RdmVq84Q3nXOI',
      authDomain: 'rollapolla-v1.firebaseapp.com',
      projectId: 'rollapolla-v1',
      storageBucket: 'rollapolla-v1.appspot.com',
      messagingSenderId: '368144624370',
      appId: '1:368144624370:web:a29654bf620dd22a1ebe6b',
    }),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
    providePortsAndAdapter(),
  ],
};
