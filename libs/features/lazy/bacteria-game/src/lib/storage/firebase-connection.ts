import { EnvironmentProviders, inject } from '@angular/core';
import {
  FirebaseApp,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { Auth, provideAuth } from '@angular/fire/auth';
import { Firestore, provideFirestore } from '@angular/fire/firestore';
import * as authSdk from 'firebase/auth';
import * as dbSdk from 'firebase/firestore';
import type { GameCloudOptions } from './game-cloud';

/** The game's signed-in user and database, with the SDK calls on them. */
export interface FirebaseConnection {
  auth: Auth;
  authSdk: typeof authSdk;
  db: Firestore;
  dbSdk: typeof dbSdk;
}

/**
 * The game's own Firebase app, named so it stands next to the shell's
 * default app, which belongs to another project.
 */
const APP_NAME = 'bacteria-wars';

/**
 * The game's Firebase app, Auth and Firestore through AngularFire, for the
 * providers of the route the game is loaded under. On that route they stand
 * in for the shell's, which belong to another project. The database keeps a
 * copy in the browser, shared by its tabs, so the progress shows offline as
 * well.
 */
export function provideFirebase(
  options: GameCloudOptions
): EnvironmentProviders[] {
  const { emulators } = options;
  return [
    provideFirebaseApp(() => initializeApp(options.firebase, APP_NAME)),
    provideAuth((injector) => {
      // No popup resolver: getAuth's would load Google's sign-in frame on
      // phones as the game starts. It joins at the sign-in instead.
      const auth = authSdk.initializeAuth(injector.get(FirebaseApp), {
        persistence: [
          authSdk.indexedDBLocalPersistence,
          authSdk.browserLocalPersistence,
        ],
      });
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
 *
 * The backends call the Firebase SDK itself on the instances AngularFire
 * provides, not AngularFire's wrapped functions: the app is zoneless, where
 * the wrapping only adds pending tasks - a write held offline would keep the
 * app from ever turning stable - and it wraps every function argument as a
 * callback, the popup resolver class included.
 */
export function injectFirebaseConnection(): FirebaseConnection {
  return { auth: inject(Auth), authSdk, db: inject(Firestore), dbSdk };
}
