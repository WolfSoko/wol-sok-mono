import {
  EnvironmentInjector,
  EnvironmentProviders,
  inject,
  runInInjectionContext,
} from '@angular/core';
import {
  FirebaseApp,
  getApps,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import * as authSdk from '@angular/fire/auth';
import { Auth, provideAuth } from '@angular/fire/auth';
import * as dbSdk from '@angular/fire/firestore';
import { Firestore, provideFirestore } from '@angular/fire/firestore';
import type { GameCloudOptions } from './game-cloud';

/** The game's signed-in user and database, with the AngularFire calls on them. */
export interface FirebaseConnection {
  auth: Auth;
  authSdk: typeof authSdk;
  db: Firestore;
  dbSdk: typeof dbSdk;
  /**
   * Runs a call to the SDK in the injection context of the route that set
   * the project up, where AngularFire expects its calls.
   */
  run: <T>(call: () => T) => T;
}

/**
 * The game's own Firebase app, named so it stands next to the shell's
 * default app, which belongs to another project.
 */
const APP_NAME = 'bacteria-wars';

/**
 * The game's Firebase app, Auth and Firestore, for the providers of the
 * route the game is loaded under. On that route they stand in for the
 * shell's, which belong to another project. The database keeps a copy in
 * the browser, shared by its tabs, so the progress shows offline as well.
 */
export function provideFirebase(
  options: GameCloudOptions
): EnvironmentProviders[] {
  const { emulators } = options;
  return [
    provideFirebaseApp(
      () =>
        getApps().find((app) => app.name === APP_NAME) ??
        initializeApp(options.firebase, APP_NAME)
    ),
    provideAuth((injector) => {
      // The standard setup: the sign-in kept in IndexedDB, and the popup
      // resolver set on the instance - handed to linkWithPopup instead,
      // AngularFire would wrap the resolver class like a callback.
      const auth = authSdk.getAuth(injector.get(FirebaseApp));
      if (emulators !== undefined) {
        authSdk.connectAuthEmulator(auth, emulators.authUrl, {
          disableWarnings: true,
        });
      }
      return auth;
    }),
    provideFirestore((injector) => {
      const db = dbSdk.initializeFirestore(injector.get(FirebaseApp), {
        localCache: dbSdk.persistentLocalCache({
          tabManager: dbSdk.persistentMultipleTabManager(),
        }),
      });
      if (emulators !== undefined) {
        dbSdk.connectFirestoreEmulator(
          db,
          emulators.firestoreHost,
          emulators.firestorePort
        );
      }
      return db;
    }),
  ];
}

/**
 * The connection to the game's project, from the injection context of the
 * route that provides it (`provideFirebase`).
 */
export function injectFirebaseConnection(): FirebaseConnection {
  const injector = inject(EnvironmentInjector);
  return {
    auth: inject(Auth),
    authSdk,
    db: inject(Firestore),
    dbSdk,
    run: (call) => runInInjectionContext(injector, call),
  };
}
