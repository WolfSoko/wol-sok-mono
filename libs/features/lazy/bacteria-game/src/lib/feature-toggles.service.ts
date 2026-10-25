import { inject, Injectable, signal } from '@angular/core';
import {
  FEATURE_TOGGLE_KEYS,
  FEATURE_TOGGLES,
  featureToggles,
  type FeatureToggles,
} from './state/feature-toggles';
import { GameToggles } from './storage/game-toggles';

/**
 * The owner's feature toggles as the game reads them (ADR 0012): the
 * defaults (`FEATURE_TOGGLES`) at first, what Remote Config says once it
 * answered. A toggle is a switch for what players see, not a lock - the
 * functions do not read them.
 *
 * A feature that must not change in the middle of something reads its
 * toggle once, as it starts: a match keeps the simulation it began with.
 */
@Injectable({ providedIn: 'root' })
export class FeatureTogglesService {
  private readonly state = signal<FeatureToggles>(
    { ...FEATURE_TOGGLES },
    { equal: sameToggles }
  );

  /** Every toggle, set or defaulted. */
  public readonly toggles = this.state.asReadonly();

  public constructor() {
    // Root-provided like the port, so the subscription lasts the visit.
    inject(GameToggles)
      .watch()
      .subscribe({
        next: (set) => this.state.set(featureToggles((key) => set[key])),
        error: (error: unknown) =>
          console.warn('Could not read the feature toggles', error),
      });
  }
}

function sameToggles(a: FeatureToggles, b: FeatureToggles): boolean {
  return FEATURE_TOGGLE_KEYS.every((key) => a[key] === b[key]);
}
