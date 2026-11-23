import { inject, Injectable } from '@angular/core';
import {
  FEATURE_TOGGLES,
  type FeatureToggleStates,
  GameCloud,
  readToggles,
} from '@wolsok/feat-lazy-bac-game/admin-kit';

/** The game's fetch interval, which a fresh read lifts for one fetch. */
const GAME_FETCH_INTERVAL_MS = 3_600_000;

/** The toggles as Remote Config holds them now. */
export interface TogglesRead {
  /** False where Remote Config cannot be reached (the emulators). */
  available: boolean;
  /** Every toggle's state: what Remote Config holds, else its default. */
  values: FeatureToggleStates;
  /** The toggles Remote Config holds; the others play their default. */
  set: Partial<FeatureToggleStates>;
}

/**
 * Reads the feature toggles (ADR 0012) through the game's Remote Config
 * connection - one shared instance, so the admin reads what a player's
 * device would. `fresh` fetches past the game's one-hour cache, so a value
 * the owner just published shows (the backend may still answer from its
 * own cache for a little while).
 */
@Injectable({ providedIn: 'root' })
export class AdminTogglesService {
  private readonly cloud = inject(GameCloud);

  public async read(fresh: boolean): Promise<TogglesRead> {
    const rc = (await this.cloud.firebase()?.remoteConfig()) ?? null;
    if (rc === null) {
      return { available: false, values: { ...FEATURE_TOGGLES }, set: {} };
    }
    if (fresh) {
      rc.config.settings.minimumFetchIntervalMillis = 0;
      try {
        await rc.sdk.fetchAndActivate(rc.config);
      } finally {
        rc.config.settings.minimumFetchIntervalMillis = GAME_FETCH_INTERVAL_MS;
      }
    }
    const set = readToggles(rc);
    return { available: true, values: { ...FEATURE_TOGGLES, ...set }, set };
  }
}
