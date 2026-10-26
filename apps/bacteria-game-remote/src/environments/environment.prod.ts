// The workspace's version, which names the release tag: a root file, not a
// project's code (and no edge in the project graph).
// eslint-disable-next-line @nx/enforce-module-boundaries
import { version } from '../../../../version.json';
import { Environment } from './environment.type';
import { SUPPORT_DEFAULTS } from './game-support';

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
    // The functions and the rules for recorded matches are deployed (ADR
    // 0011): online matches, and local ones with "Save my matches", are
    // uploaded and listed in "My matches".
    replays: true,
  },
  // index.html loads AdSense and its consent banner. For ads on the menu
  // screens, add the display ad unit from AdSense:
  // ads: { client: 'ca-pub-6346271540341424', slot: '<ad unit id>' }
  support: SUPPORT_DEFAULTS,
  // Error reports to the Sentry project `bacteria-wars` (owner's decision
  // of 2026-10-26). A DSN is public by design. The release is the one the
  // release workflow creates: the tag `v<version.json>` it builds from.
  sentry: {
    dsn: 'https://1624d373f20e21df253a680b693b99f9@o1384048.ingest.us.sentry.io/4512322908520448',
    environment: 'production',
    release: `bacteria-wars@v${version}`,
  },
};
