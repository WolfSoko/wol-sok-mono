import type { Environment, FirebaseEmulatoren } from './environment.type';

/** What `korbjaeger:emulatoren` runs (`firebase.emulatoren.json`). */
const EMULATOREN: FirebaseEmulatoren = {
  projektId: 'demo-korbjaeger',
  authUrl: 'http://127.0.0.1:9199',
  firestore: { host: '127.0.0.1', port: 8491 },
};

/**
 * The environment of a build in `modus`: `production` deploys and signs in
 * on the real project; development, e2e and the specs sign in against the
 * emulators.
 */
export function environmentFuer(modus: string): Environment {
  const produktion = modus === 'production';
  return {
    // The app's own Firebase project, the one `.firebaserc` names (its spec
    // keeps both equal). A web app config is public by design: the rules and
    // the authorized domains guard the project.
    firebase: {
      apiKey: 'AIzaSyByHG1qydchee0ADUQwVSLAv0ggrx63dTs',
      authDomain: 'korbjaeger.firebaseapp.com',
      projectId: 'korbjaeger',
      storageBucket: 'korbjaeger.firebasestorage.app',
      messagingSenderId: '1062488240786',
      appId: '1:1062488240786:web:659a49b051aa953cab2c4b',
    },
    // live since #2873, covered by the privacy policy (#2874)
    anmeldung: true,
    emulatoren: produktion ? undefined : EMULATOREN,
  };
}

export const environment: Environment = environmentFuer(import.meta.env.MODE);
