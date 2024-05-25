import { EnvironmentProviders } from '@angular/core';
import {
  FirebaseOptions,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

export function provideDataAccess(
  options: FirebaseOptions = environment.firebaseConfig
): EnvironmentProviders[] {
  return [
    provideFirebaseApp(() => initializeApp(options)),
    provideFirestore(() => getFirestore()),
  ];
}
