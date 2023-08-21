import { EnvironmentProviders, importProvidersFrom, ModuleWithProviders } from '@angular/core';
import { FirebaseAppModule, getApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import {
  connectFirestoreEmulator,
  FirestoreModule,
  initializeFirestore,
  provideFirestore,
} from '@angular/fire/firestore';
import { persistentLocalCache } from '@firebase/firestore';
import { RollaPollaEnv } from '../environments/rolla-polla.env';

export function provideRollapollaFirebase({
  isDev,
  useEmulator,
  firebaseOptions,
}: RollaPollaEnv): EnvironmentProviders {
  // Firebase App
  const firebaseAppModule: ModuleWithProviders<FirebaseAppModule> = provideFirebaseApp(() =>
    initializeApp(firebaseOptions)
  );
  const firestoreModule: ModuleWithProviders<FirestoreModule> = provideFirestore(() => {
    const firestore = initializeFirestore(getApp(), {
      experimentalForceLongPolling: isDev,
      localCache: isDev ? persistentLocalCache() : undefined,
    });

    if (useEmulator) {
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    }
    return firestore;
  });

  return importProvidersFrom(firebaseAppModule, firestoreModule);
}
