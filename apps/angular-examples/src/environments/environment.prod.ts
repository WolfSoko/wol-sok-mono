import { Environment } from './environment.type';

import packageJson from '../../../../package.json';

export const environment: Environment = {
  version: packageJson.version,
  production: true,
  serviceWorkerCheckInterval: 30000,
  firebaseConfig: {
    apiKey: 'AIzaSyDA2Q6A4MrhgYlJnjaWycO-M6D8ToXRYAM',
    authDomain: 'angularexamples-b69f4.firebaseapp.com',
    databaseURL: 'https://angularexamples-b69f4.firebaseio.com',
    projectId: 'angularexamples-b69f4',
    storageBucket: 'angularexamples-b69f4.appspot.com',
    messagingSenderId: '311456846239',
  },
};
