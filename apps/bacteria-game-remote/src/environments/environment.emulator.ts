import { Environment } from './environment.type';

/**
 * Development against the local Firebase emulators, started by
 * `nx run bacteria-game-remote:firebase-emulators`. A `demo-` project needs
 * no real project and no credentials.
 */
export const environment: Environment = {
  production: false,
  gameCloud: {
    firebase: {
      apiKey: 'demo-key',
      authDomain: 'demo-bacteria-wars.firebaseapp.com',
      projectId: 'demo-bacteria-wars',
    },
    emulators: {
      authUrl: 'http://127.0.0.1:9099',
      firestoreHost: '127.0.0.1',
      firestorePort: 8080,
    },
  },
};
