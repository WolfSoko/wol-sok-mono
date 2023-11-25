import { EnvironmentProviders, importProvidersFrom, ModuleWithProviders } from '@angular/core';
import { FirebaseAppModule, FirebaseOptions, initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { FirestoreModule, getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';

export function provideDataAccess(options?: FirebaseOptions): EnvironmentProviders {
  return importProvidersFrom(provideDataAccessAsModules(options));
}

function provideDataAccessAsModules(
  options: FirebaseOptions = environment.firebaseConfig
): [ModuleWithProviders<FirebaseAppModule>, ModuleWithProviders<FirestoreModule>] {
  return [provideFirebaseApp(() => initializeApp(options)), provideFirestore(() => getFirestore())];
}
