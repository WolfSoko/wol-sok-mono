import {
  EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  injectFirebaseConnection,
  provideFirebase,
} from './firebase-connection';
import { GameCloud, GameCloudOptions } from './game-cloud';

/**
 * Connects the game to its Firebase project: the player's progress then
 * follows their account, a guest one at first, one they can sign in to
 * with Google later. Without options - no project set up yet - everything
 * stays in the browser's local storage.
 *
 * Belongs into the providers of the route the game is loaded under, so it
 * holds inside the shell, which never sees the remote's app config, as
 * well as on the game's own page.
 */
export function provideGameCloud(
  options: GameCloudOptions | null
): EnvironmentProviders[] {
  if (options === null) {
    return [provideEnvironmentInitializer(() => inject(GameCloud).use(null))];
  }
  return [
    ...provideFirebase(options),
    provideEnvironmentInitializer(() =>
      inject(GameCloud).use(injectFirebaseConnection())
    ),
  ];
}
