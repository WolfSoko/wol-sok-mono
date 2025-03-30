import { EnvironmentProviders } from '@angular/core';
import {
  FirebaseApp,
  FirebaseOptions,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import {
  connectFirestoreEmulator,
  getFirestore,
  provideFirestore,
} from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

export type DataAccessOptions = FirebaseOptions;

export type FirestoreEmulatorOptions = {
  emulated: boolean;
  host: string;
  port: number;
};

export function provideDataAccess(
  options: FirebaseOptions = environment.firebaseConfig,
  firestoreEmulatorOptions?: FirestoreEmulatorOptions
): EnvironmentProviders[] {
  return [
    provideFirebaseApp(() => initializeApp(options)),
    provideFirestore((inject) => {
      const fs = getFirestore(inject.get(FirebaseApp));
      if (firestoreEmulatorOptions?.emulated) {
        console.log('connecting to firestore emulator');
        connectFirestoreEmulator(fs, 'localhost', 8080);
      }
      return fs;
    }),
  ];
}
