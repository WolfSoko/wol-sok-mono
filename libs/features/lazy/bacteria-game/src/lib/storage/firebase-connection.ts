import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { GameCloudOptions } from './game-cloud';

/** The game's Firebase app, signed-in user and database, with their SDKs. */
export interface FirebaseConnection {
  auth: Auth;
  authSdk: typeof import('firebase/auth');
  db: Firestore;
  dbSdk: typeof import('firebase/firestore');
}

/**
 * The game's own Firebase app, named so it stands next to the shell's
 * default app, which belongs to another project. The SDK loads only once
 * the game uses the cloud.
 */
const APP_NAME = 'bacteria-wars';

/**
 * Connects to the game's Firebase project. The database keeps a copy in the
 * browser, shared by its tabs, so the progress shows offline as well.
 */
export async function connectFirebase(
  options: GameCloudOptions
): Promise<FirebaseConnection> {
  const [appSdk, authSdk, dbSdk] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore'),
  ]);
  const existing = appSdk.getApps().find((app) => app.name === APP_NAME);
  if (existing !== undefined) {
    // Set up before - a module reloaded in development.
    const auth = authSdk.getAuth(existing);
    return { auth, authSdk, db: dbSdk.getFirestore(existing), dbSdk };
  }
  const app = appSdk.initializeApp(options.firebase, APP_NAME);
  // The popup resolver joins at the sign-in (FirebaseGameAccount): set up
  // here, it loads Google's sign-in frame on phones as the game starts.
  const auth = authSdk.initializeAuth(app, {
    persistence: [
      authSdk.indexedDBLocalPersistence,
      authSdk.browserLocalPersistence,
    ],
  });
  const db = dbSdk.initializeFirestore(app, {
    localCache: dbSdk.persistentLocalCache({
      tabManager: dbSdk.persistentMultipleTabManager(),
    }),
  });
  const { emulators } = options;
  if (emulators !== undefined) {
    authSdk.connectAuthEmulator(auth, emulators.authUrl, {
      disableWarnings: true,
    });
    dbSdk.connectFirestoreEmulator(
      db,
      emulators.firestoreHost,
      emulators.firestorePort
    );
  }
  return { auth, authSdk, db, dbSdk };
}
