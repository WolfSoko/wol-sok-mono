import { inject, Injector } from '@angular/core';
import type { GameId, GameReport } from '@wolsok/feat-shared-basketball-data';
import {
  basketballDataResource,
  type DatenResource,
} from './basketball-data-resource';

/**
 * A resource reading the Spielbericht (both Kader) of the Spiel `spielId`
 * gives, none while it gives none, and `undefined` as its value while the
 * Spiel has none; a new id cancels the read of the last. Created in an
 * injection context, or on `injector`.
 */
export function spielberichtResource(
  spielId: () => GameId | undefined,
  injector: Injector = inject(Injector)
): DatenResource<GameReport | undefined> {
  return basketballDataResource(
    spielId,
    (data, spiel, options) => data.gameReport(spiel, options),
    injector
  );
}
