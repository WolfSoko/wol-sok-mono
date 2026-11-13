import { inject, Injector } from '@angular/core';
import type { GameDetails, GameId } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DataResource,
} from './basketball-data-resource';

/**
 * A resource reading the details (result, quarters, Halle) of the Spiel
 * `gameId` gives, none while it gives none; a new id cancels the read of
 * the last. Created in an injection context, or on `injector`.
 */
export function gameDetailsResource(
  gameId: () => GameId | undefined,
  injector: Injector = inject(Injector)
): DataResource<GameDetails | undefined> {
  return basketballDataResource(
    gameId,
    (data, game, options) => data.game(game, options),
    injector
  );
}
