import { Environment } from './environment.type';

export const environment: Environment = {
  // The app's own Firebase project, the one `.firebaserc` names (its spec
  // keeps both equal). A web app config is public by design: the rules and
  // the authorized domains guard the project. Nothing reads it before
  // sign-in (#2873).
  firebase: {
    apiKey: 'AIzaSyByHG1qydchee0ADUQwVSLAv0ggrx63dTs',
    authDomain: 'korbjaeger.firebaseapp.com',
    projectId: 'korbjaeger',
    storageBucket: 'korbjaeger.firebasestorage.app',
    messagingSenderId: '1062488240786',
    appId: '1:1062488240786:web:659a49b051aa953cab2c4b',
  },
};
