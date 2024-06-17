import { provideFileRouter } from '@analogjs/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection,
} from '@angular/core';
import {
  FirebaseApp,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  provideFirestore,
} from '@angular/fire/firestore';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { provideClientHydration } from '@angular/platform-browser';
import { withEnabledBlockingInitialNavigation } from '@angular/router';
import { environment } from '../environments/environment';
import { providePortsAndAdapter } from './provide-ports-and.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideFileRouter(withEnabledBlockingInitialNavigation()),
    provideClientHydration(),
    provideHttpClient(withFetch()),
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
    [
      provideFirebaseApp(() =>
        initializeApp(environment.dataAccessOptions, {})
      ),
      provideFirestore((inject) => {
        const fs = getFirestore(inject.get(FirebaseApp));
        if (!environment.prod) {
          console.log('connecting to firestore emulator');
          connectFirestoreEmulator(fs, 'localhost', 8080);
        }
        return fs;
      }),
    ],
    providePortsAndAdapter(),
  ],
};
