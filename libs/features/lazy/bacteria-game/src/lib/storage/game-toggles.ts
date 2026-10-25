import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { FeatureToggles } from '../state/feature-toggles';
import { GameCloud } from './game-cloud';

/**
 * Where the owner's feature toggles come from (ADR 0012): the project's
 * Remote Config (`RemoteConfigGameToggles`), nothing without a project
 * (`NoGameToggles`). Asked of `GameCloud.toggles()`; the game reads them
 * through `FeatureTogglesService`, which fills in the defaults
 * (`FEATURE_TOGGLES`). A spec provides its own with `provideGameToggles`
 * (`src/testing/fake-game-toggles.ts`).
 */
@Injectable({
  providedIn: 'root',
  useFactory: () => inject(GameCloud).toggles(),
})
export abstract class GameToggles {
  /**
   * The toggles the owner set - only those: one that is not set is left
   * out, and takes its default. Emits once the backend knows, which may be
   * a while after the subscription, and again should it learn of a change
   * (Remote Config fetches once a visit, so it emits once). Never errors:
   * a backend that cannot tell emits `{}`, the defaults.
   */
  public abstract watch(): Observable<Partial<FeatureToggles>>;
}
