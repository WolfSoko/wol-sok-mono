import type { FirebaseOptions } from 'firebase/app';

/** Where a build without the real project finds Firebase: the local emulators. */
export interface FirebaseEmulatoren {
  /** A `demo-` project, so nothing reaches a real one. */
  readonly projektId: string;
  /** The Auth emulator, as `connectAuthEmulator` takes it. */
  readonly authUrl: string;
  readonly firestore: { readonly host: string; readonly port: number };
}

export type Environment = {
  /** The web app config of the Firebase project `.firebaserc` names. */
  firebase: FirebaseOptions;
  /**
   * Whether the app offers the Google sign-in (#2873): its settings, the
   * account's sync. On in every mode; `/privacy` (#2874) covers it.
   */
  anmeldung: boolean;
  /** Set where the build talks to the local emulators instead (`korbjaeger:emulatoren`). */
  emulatoren?: FirebaseEmulatoren;
};
