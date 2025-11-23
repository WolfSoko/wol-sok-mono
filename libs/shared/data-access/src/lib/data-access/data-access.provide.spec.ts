import { FirebaseApp } from '@angular/fire/app';
import { Firestore } from '@angular/fire/firestore';
import { describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { provideDataAccess } from './data-access.provide';
import { mock, MockProxy } from 'vitest-mock-extended';
import { EnvironmentProviders, Injector } from '@angular/core';

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  provideFirebaseApp: vi.fn((fn) => fn()),
  connectFirestoreEmulator: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  provideFirestore: vi.fn(),
}));

vi.mock('@angular/fire/app', () => ({
  FirebaseApp: vi.fn(),
  initializeApp: mocks.initializeApp,
  provideFirebaseApp: mocks.provideFirebaseApp,
}));

vi.mock('@angular/fire/firestore', () => ({
  connectFirestoreEmulator: mocks.connectFirestoreEmulator,
  getFirestore: mocks.getFirestore,
  provideFirestore: mocks.provideFirestore,
}));

describe('provideDataAccess', () => {
  let firestore: MockProxy<Firestore>;
  let injectorMock: MockProxy<Injector>;
  let provideFirebaseCallbackResult: Firestore | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    firestore = mock<Firestore>();
    injectorMock = mock<Injector>();
    mocks.getFirestore.mockReturnValue(firestore);

    mocks.provideFirestore.mockImplementation(
      (callback: (injector: Injector) => Firestore): EnvironmentProviders => {
        provideFirebaseCallbackResult = callback(injectorMock, ...[]);
        return provideFirebaseCallbackResult as unknown as EnvironmentProviders;
      }
    );
  });

  it('should initialize Firebase app with default options', () => {
    // When
    provideDataAccess();

    // Then
    expect(mocks.initializeApp).toHaveBeenCalledWith(
      environment.firebaseConfig
    );
    expect(mocks.provideFirebaseApp).toHaveBeenCalled();
    expect(injectorMock.get).toHaveBeenCalledWith(FirebaseApp);
    expect(provideFirebaseCallbackResult).toEqual(firestore);
  });

  it('should initialize Firebase app with given options', () => {
    // Given
    const options = { apiKey: 'test-key' };

    // When
    provideDataAccess(options);

    // Then
    expect(mocks.initializeApp).toHaveBeenCalledWith(options);
  });

  it('should connect to Firestore emulator when emulated', () => {
    // Given
    const firestoreEmulatorOptions = {
      emulated: true,
      host: 'localhost',
      port: 8080,
    };

    // When
    provideDataAccess(undefined, firestoreEmulatorOptions);

    // Then
    expect(mocks.connectFirestoreEmulator).toHaveBeenCalledWith(
      expect.any(Object),
      'localhost',
      8080
    );
  });

  it('should not connect to Firestore emulator when not emulated', () => {
    // Given
    const firestoreEmulatorOptions = {
      emulated: false,
      host: 'localhost',
      port: 8080,
    };

    // When
    provideDataAccess(undefined, firestoreEmulatorOptions);

    // Then
    expect(mocks.connectFirestoreEmulator).not.toHaveBeenCalled();
  });
});
