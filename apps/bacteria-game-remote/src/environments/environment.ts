// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { Environment } from './environment.type';

export const environment: Environment = {
  production: false,
  // `nx run bacteria-game-remote:serve-emulator` plays against the local
  // Firebase emulators instead.
  gameCloud: null,
  // The coffee link and the tips; no ads outside the live site.
  support: {
    buyMeACoffeeHandle: 'wolf',
    playTipProductIds: ['tip_small', 'tip_medium', 'tip_large'],
    ads: null,
  },
};
