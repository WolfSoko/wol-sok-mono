import {
  importProvidersFrom,
  ModuleWithProviders,
  NgModule,
} from '@angular/core';
import {
  FirebaseOptions,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { environment } from '../../environments/environment';
import { provideDataAccess } from './data-access.provide';

@NgModule()
class FirebaseApp {}

@NgModule()
class Firestore {}

const firebaseAppProvider: ModuleWithProviders<FirebaseApp> = {
  ngModule: FirebaseApp,
  providers: [FirebaseApp],
};

jest.mock('@angular/core', () => ({
  ...jest.requireActual('@angular/core'),
  importProvidersFrom: jest.fn(),
}));

jest.mock('@angular/fire/app', () => ({
  initializeApp: jest.fn(() => firebaseAppProvider),
  provideFirebaseApp: jest.fn(
    (...args: Parameters<typeof provideFirebaseApp>) => args[0](args[1])
  ),
}));

const firestoreProvider: ModuleWithProviders<Firestore> = {
  ngModule: Firestore,
  providers: [Firestore],
};

jest.mock('@angular/fire/firestore', () => ({
  provideFirestore: jest.fn((...args: Parameters<typeof provideFirestore>) =>
    args[0](args[1])
  ),
  getFirestore: jest.fn(() => firestoreProvider),
}));

describe('DataAccess', () => {
  it('should have a function to provide data access', () => {
    expect(provideDataAccess).toBeTruthy();
  });

  it('should configure firebase app', () => {
    provideDataAccess();
    expect(initializeApp).toHaveBeenCalledWith(environment.firebaseConfig);
  });

  it('should configure firebase app with given options', () => {
    const options: FirebaseOptions = {
      apiKey: '1235667',
    };
    provideDataAccess(options);
    expect(initializeApp).toHaveBeenCalledWith(options);
  });

  it('should configure firestore', () => {
    provideDataAccess();
    expect(provideFirestore).toHaveBeenCalled();
    expect(getFirestore).toHaveBeenCalled();
  });

  it('should return EnvironmentProviders for FirebaseApp and Firestore', () => {
    (importProvidersFrom as jest.Mock).mockReset();
    (importProvidersFrom as jest.Mock).mockReturnValue('mockedResult');
    const result = provideDataAccess();
    expect(result as unknown).toEqual('mockedResult');
    expect(importProvidersFrom).toHaveBeenCalledWith([
      firebaseAppProvider,
      firestoreProvider,
    ]);
  });
});
