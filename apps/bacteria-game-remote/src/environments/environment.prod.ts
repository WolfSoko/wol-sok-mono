import { Environment } from './environment.type';

export const environment: Environment = {
  production: true,
  // The game's own Firebase project. A web app config is public by design:
  // the Firestore rules and the authorized domains guard the project.
  gameCloud: {
    firebase: {
      apiKey: 'AIzaSyAEDI0LGQSjnAVJEYJlHNND-jiaYXDfntA',
      authDomain: 'bacteria-wars.firebaseapp.com',
      projectId: 'bacteria-wars',
      storageBucket: 'bacteria-wars.firebasestorage.app',
      messagingSenderId: '156895060649',
      appId: '1:156895060649:web:04a7768a8b69381130bfb8',
      measurementId: 'G-5HSMB2CHGY',
      // The Realtime Database keeps who is online (ADR 0010).
      databaseURL:
        'https://bacteria-wars-default-rtdb.europe-west1.firebasedatabase.app',
    },
  },
};
