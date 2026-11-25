import { releaseName } from '@wolsok/utils-version';
import { Environment } from './environment.type';
import { version } from './version';

export const environment: Environment = {
  version,
  production: true,
  serviceWorkerCheckInterval: 60000,
  firebaseConfig: {
    apiKey: 'AIzaSyDA2Q6A4MrhgYlJnjaWycO-M6D8ToXRYAM',
    authDomain: 'angularexamples-b69f4.firebaseapp.com',
    databaseURL: 'https://angularexamples-b69f4.firebaseio.com',
    projectId: 'angularexamples-b69f4',
    storageBucket: 'angularexamples-b69f4.appspot.com',
    messagingSenderId: '311456846239',
  },
  // Error reports to the Sentry project `angular-examples`: errors only, no
  // personal data (#3236), the options of `@wolsok/shared-error-reports`.
  sentry: {
    dsn: 'https://d7eab9a5f3484e48b3cf9c110533dcbe@o1384048.ingest.sentry.io/6702682',
    environment: 'production',
    release: releaseName('angular-examples'),
  },
};
