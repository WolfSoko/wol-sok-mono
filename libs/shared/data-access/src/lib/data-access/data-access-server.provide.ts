import { EnvironmentProviders } from '@angular/core';
import {
  FirebaseApp,
  FirebaseOptions,
  initializeServerApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

export function provideDataAccessServer(
  options: FirebaseOptions = environment.firebaseConfig
): EnvironmentProviders[] {
  return [
    provideFirebaseApp(() => initializeServerApp(options, {})),
    provideFirestore((inject) => getFirestore(inject.get(FirebaseApp))),
  ];
}
