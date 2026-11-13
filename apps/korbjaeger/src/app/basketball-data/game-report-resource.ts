import { inject, Injector } from '@angular/core';
import type { GameId, GameReport } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DataResource,
} from './basketball-data-resource';

/**
 * A resource reading the Spielbericht (both Kader) of the Spiel `gameId`
 * gives, none while it gives none, and `undefined` as its value while the
 * Spiel has none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function gameReportResource(
  gameId: () => GameId | undefined,
  injector: Injector = inject(Injector)
): DataResource<GameReport | undefined> {
  return basketballDataResource(
    gameId,
    (data, game, options) => data.gameReport(game, options),
    injector
  );
}
