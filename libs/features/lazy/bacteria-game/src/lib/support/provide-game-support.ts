import {
  afterNextRender,
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { GameAds } from './game-ads.service';
import { GAME_SUPPORT, GameSupportOptions } from './game-support';

/**
 * Turns on the tips and the ads. Belongs into the game's own app config,
 * not into the route: inside the shell, which has no consent banner of its
 * own for the ads, the game stays free of both.
 */
export function provideGameSupport(
  options: GameSupportOptions
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: GAME_SUPPORT, useValue: options },
    // The consent banner comes with the ad script, and has to be up before
    // the first ad is asked for - so the script loads with the app, once
    // its first view is up.
    provideEnvironmentInitializer(() => {
      const ads = inject(GameAds);
      afterNextRender(() => ads.start());
    }),
  ]);
}
