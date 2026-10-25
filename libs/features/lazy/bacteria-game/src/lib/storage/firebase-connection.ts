import {
  EnvironmentProviders,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import {
  FirebaseApp,
  getApps,
  initializeApp,
  provideFirebaseApp,
} from '@angular/fire/app';
import { Auth, provideAuth } from '@angular/fire/auth';
import { Database, provideDatabase } from '@angular/fire/database';
import { Firestore, provideFirestore } from '@angular/fire/firestore';
import * as authSdk from 'firebase/auth';
import * as dbSdk from 'firebase/firestore';
import * as rtdbSdk from 'firebase/database';
import type * as remoteConfigSdk from 'firebase/remote-config';
import type { GameCloudOptions } from './game-cloud';

/** The game's Remote Config, fetched and activated, with the SDK calls on it. */
export interface RemoteConfigConnection {
  config: remoteConfigSdk.RemoteConfig;
  sdk: typeof remoteConfigSdk;
}

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
  /**
   * The project's Remote Config, where the owner's feature toggles live
   * (ADR 0012): loaded on first call, not with the game - the SDK comes in
   * a chunk of its own - then fetched (at most once an hour, the rest of
   * the time from the browser's copy) and activated. The same answer for
   * every caller. Null where Remote Config cannot run: against the
   * emulators (there is none for it), in a browser without IndexedDB, or
   * when its SDK failed to load. A failed fetch still answers, with what
   * this browser fetched last - nothing on a first visit. Never rejects.
   */
  remoteConfig(): Promise<RemoteConfigConnection | null>;
}

/** Whether the project takes recorded matches, from its options. */
const TAKES_REPLAYS = new InjectionToken<boolean>('bacteria-wars replays');

/** Whether the project's Remote Config is fetched - not against the emulators. */
const FETCHES_REMOTE_CONFIG = new InjectionToken<boolean>(
  'bacteria-wars remote config'
);

/**
 * How old the browser's copy of Remote Config may be before it is fetched
 * again: a toggle the owner flips reaches a player within the hour, or at
 * their next visit after that.
 */
const REMOTE_CONFIG_MAX_AGE_MS = 3_600_000;

/** How long a fetch of Remote Config may take before the copy answers. */
const REMOTE_CONFIG_FETCH_TIMEOUT_MS = 10_000;

/**
 * The game's own Firebase app, named so it stands next to the shell's
 * default app, which belongs to another project.
 */
const APP_NAME = 'bacteria-wars';

/**
 * The instances started on the game's app, kept so a second route that
 * provides the project (the admin area beside the game) reuses them: Auth
 * and Firestore throw when initialised twice, and an emulator connection
 * throws once an instance is in use.
 */
const started: {
  auth?: authSdk.Auth;
  db?: dbSdk.Firestore;
  rtdb?: rtdbSdk.Database;
  remoteConfig?: Promise<RemoteConfigConnection | null>;
} = {};

/**
 * The game's Firebase app, Auth and Firestore through AngularFire, for the
 * providers of the route the game is loaded under. On that route they stand
 * in for the shell's, which belong to another project. The database keeps a
 * copy in the browser, shared by its tabs, so the progress shows offline as
 * well. Idempotent: another route providing the project (the admin area)
 * gets the same app and instances, so both share one sign-in.
 */
export function provideFirebase(
  options: GameCloudOptions
): EnvironmentProviders[] {
  const { emulators } = options;
  return [
    makeEnvironmentProviders([
      { provide: TAKES_REPLAYS, useValue: options.replays === true },
      { provide: FETCHES_REMOTE_CONFIG, useValue: emulators === undefined },
    ]),
    provideFirebaseApp(
      () =>
        getApps().find((app) => app.name === APP_NAME) ??
        initializeApp(options.firebase, APP_NAME)
    ),
    provideAuth((injector) => {
      if (started.auth !== undefined) {
        return started.auth;
      }
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
      started.auth = auth;
      return auth;
    }),
    provideFirestore((injector) => {
      if (started.db !== undefined) {
        return started.db;
      }
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
      started.db = db;
      return db;
    }),
    // Only with a database in the config: the online status needs one,
    // nothing else does.
    ...(options.firebase.databaseURL === undefined
      ? []
      : [
          provideDatabase((injector) => {
            if (started.rtdb !== undefined) {
              return started.rtdb;
            }
            const rtdb = rtdbSdk.getDatabase(injector.get(FirebaseApp));
            if (emulators?.databasePort !== undefined) {
              rtdbSdk.connectDatabaseEmulator(
                rtdb,
                emulators.firestoreHost,
                emulators.databasePort
              );
            }
            started.rtdb = rtdb;
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
  const app = inject(FirebaseApp);
  const fetchesRemoteConfig =
    inject(FETCHES_REMOTE_CONFIG, { optional: true }) ?? false;
  return {
    auth: inject(Auth),
    authSdk,
    db: inject(Firestore),
    dbSdk,
    rtdb: inject(Database, { optional: true }),
    rtdbSdk,
    replays: inject(TAKES_REPLAYS, { optional: true }) ?? false,
    remoteConfig: () =>
      fetchesRemoteConfig ? startRemoteConfig(app) : Promise.resolve(null),
  };
}

/**
 * Loads the Remote Config SDK, sets it up on the game's app and fetches it -
 * once, whoever asks: see {@link FirebaseConnection.remoteConfig}. Imported
 * on demand, so the SDK stays off the game's start.
 */
function startRemoteConfig(
  app: FirebaseApp
): Promise<RemoteConfigConnection | null> {
  started.remoteConfig ??= (async () => {
    try {
      const sdk = await import('firebase/remote-config');
      if (!(await sdk.isSupported())) {
        return null;
      }
      const config = sdk.getRemoteConfig(app);
      config.settings.minimumFetchIntervalMillis = REMOTE_CONFIG_MAX_AGE_MS;
      config.settings.fetchTimeoutMillis = REMOTE_CONFIG_FETCH_TIMEOUT_MS;
      // The copy this browser fetched last, before the fetch may fail.
      await sdk.ensureInitialized(config);
      try {
        await sdk.fetchAndActivate(config);
      } catch (error) {
        console.warn('Could not fetch Remote Config', error);
      }
      return { config, sdk };
    } catch (error) {
      console.warn('Could not start Remote Config', error);
      return null;
    }
  })();
  return started.remoteConfig;
}
