import type { FirebaseApp, FirebaseOptions } from 'firebase/app';

/**
 * The game's own Firebase app, named so it stands next to the shell's
 * default app, which belongs to another project.
 */
const GAME_FIREBASE_APP = 'bacteria-wars';

/** What of the Firebase SDK (or AngularFire's copy of it) starts an app. */
export interface FirebaseAppSdk {
  getApps(): FirebaseApp[];
  initializeApp(options: FirebaseOptions, name: string): FirebaseApp;
}

/**
 * The game's named app: the one started already - by the game cloud or the
 * site's analytics, whichever came first - or a new one. Takes the SDK, so
 * a caller can load it on demand. Types only here: this file loads no
 * Firebase.
 */
export function gameFirebaseApp(
  sdk: FirebaseAppSdk,
  options: FirebaseOptions
): FirebaseApp {
  return (
    sdk.getApps().find((app) => app.name === GAME_FIREBASE_APP) ??
    sdk.initializeApp(options, GAME_FIREBASE_APP)
  );
}
