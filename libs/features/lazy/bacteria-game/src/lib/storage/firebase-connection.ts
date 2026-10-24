import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import {
  FirebaseApp,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { Auth, provideAuth } from '@angular/fire/auth';
import { Database, provideDatabase } from '@angular/fire/database';
import { Firestore, provideFirestore } from '@angular/fire/firestore';
import * as authSdk from 'firebase/auth';
import * as dbSdk from 'firebase/firestore';
import * as rtdbSdk from 'firebase/database';
import type { GameCloudOptions } from './game-cloud';

/** The game's signed-in user and database, with the SDK calls on them. */
export interface FirebaseConnection {
  auth: Auth;
  authSdk: typeof authSdk;
  db: Firestore;
  dbSdk: typeof dbSdk;
  /** The Realtime Database, for the online status - null without one. */
  rtdb: Database | null;
  rtdbSdk: typeof rtdbSdk;
  /**
   * True once the project takes recorded matches - see
   * `GameCloudOptions.replays`. Absent, the replays stay on the device.
   */
  replays?: boolean;
}

/** Whether the project takes recorded matches, from its options. */
const TAKES_REPLAYS = new InjectionToken<boolean>('bacteria-wars replays');

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
    makeEnvironmentProviders([
      { provide: TAKES_REPLAYS, useValue: options.replays === true },
    ]),
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
    // Only with a database in the config: the online status needs one,
    // nothing else does.
    ...(options.firebase.databaseURL === undefined
      ? []
      : [
          provideDatabase((injector) => {
            const rtdb = rtdbSdk.getDatabase(injector.get(FirebaseApp));
            if (emulators?.databasePort !== undefined) {
              rtdbSdk.connectDatabaseEmulator(
                rtdb,
                emulators.firestoreHost,
                emulators.databasePort
              );
            }
            return rtdb;
          }),
        ]),
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
  return {
    auth: inject(Auth),
    authSdk,
    db: inject(Firestore),
    dbSdk,
    rtdb: inject(Database, { optional: true }),
    rtdbSdk,
    replays: inject(TAKES_REPLAYS, { optional: true }) ?? false,
  };
}
