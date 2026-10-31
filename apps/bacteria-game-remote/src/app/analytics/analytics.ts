import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import {
  gameFirebaseApp,
  type GameCloudOptions,
} from '@wolsok/feat-lazy-bac-game';
import { provideFirebaseAnalytics } from '@wolsok/shared-analytics';

/** Where the browser keeps the player's answer to the statistics question. */
const STATS_CONSENT_KEY = 'bacteria-wars-stats-consent';

/**
 * The usage statistics of the game's own site: Firebase Analytics for the
 * GA4 stream of the game's web app (`measurementId`), once the player
 * allows it in the main menu (`StatsConsent`). Only with a measurement id,
 * which only the live site's environment has - development and e2e measure
 * nothing - and never inside the shell, which loads the routes, not this
 * config. The SDK, and the game's Firebase app if the game has not started
 * it yet, load only once the player said yes.
 */
export function provideGameAnalytics(
  cloud: GameCloudOptions | null
): EnvironmentProviders {
  const firebase = cloud?.firebase;
  if (!firebase?.measurementId) {
    return makeEnvironmentProviders([]);
  }
  return provideFirebaseAnalytics({
    storageKey: STATS_CONSENT_KEY,
    app: async () => gameFirebaseApp(await import('firebase/app'), firebase),
  });
}
