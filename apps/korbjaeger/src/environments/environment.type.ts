import type { FirebaseOptions } from 'firebase/app';

export type Environment = {
  /** The web app config of the Firebase project `.firebaserc` names. */
  firebase: FirebaseOptions;
};
