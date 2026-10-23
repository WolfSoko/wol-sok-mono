import { Environment } from './environment.type';

/**
 * Development against the local Firebase emulators, started by
 * `nx run bacteria-game-remote:firebase-emulators`. A `demo-` project needs
 * no real project and no credentials. The ports are the game's own
 * (`firebase.bacteria-game-remote.json`), apart from rollapolla's emulators,
 * which may run on the same CI agent.
 */
export const environment: Environment = {
  production: false,
  gameCloud: {
    firebase: {
      apiKey: 'demo-key',
      authDomain: 'demo-bacteria-wars.firebaseapp.com',
      projectId: 'demo-bacteria-wars',
      databaseURL: 'https://demo-bacteria-wars-default-rtdb.firebaseio.com',
    },
    emulators: {
      // On the game's own host: the Google popup hands the sign-in to the
      // emulator's frame in the page, which Chromium's headless shell does
      // not always load when it comes from another site (127.0.0.1).
      authUrl: 'http://localhost:9399',
      firestoreHost: '127.0.0.1',
      firestorePort: 8380,
      databasePort: 9410,
    },
  },
  support: {
    buyMeACoffeeHandle: 'wolf',
    playTipProductIds: ['tip_small', 'tip_medium', 'tip_large'],
    ads: null,
  },
};
