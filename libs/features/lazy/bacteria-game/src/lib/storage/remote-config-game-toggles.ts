import { defer, Observable, shareReplay } from 'rxjs';
import {
  FEATURE_TOGGLE_KEYS,
  type FeatureToggles,
} from '../state/feature-toggles';
import type { RemoteConfigConnection } from './firebase-connection';
import type { GameToggles } from './game-toggles';

/**
 * The feature toggles from the project's Remote Config: one boolean
 * parameter per toggle, under the toggle's name, which the admin command
 * `toggles.set` publishes (ADR 0012). Fetched once, on the first `watch`,
 * and shared by every later one; the Remote Config SDK loads only then.
 */
export class RemoteConfigGameToggles implements GameToggles {
  private readonly toggles: Observable<Partial<FeatureToggles>>;

  /** `remoteConfig` is `FirebaseConnection.remoteConfig`. */
  public constructor(
    remoteConfig: () => Promise<RemoteConfigConnection | null>
  ) {
    this.toggles = defer(async () => {
      try {
        const connection = await remoteConfig();
        return connection === null ? {} : readToggles(connection);
      } catch (error) {
        console.warn('Could not read the feature toggles', error);
        return {};
      }
    }).pipe(shareReplay({ bufferSize: 1, refCount: false }));
  }

  public watch(): Observable<Partial<FeatureToggles>> {
    return this.toggles;
  }
}

/**
 * The toggles Remote Config holds. A parameter it does not hold reads as
 * the SDK's static value, and one that is neither "true" nor "false" is no
 * boolean the admin area would publish: both are left out, so the toggle
 * keeps its default.
 */
export function readToggles({
  config,
  sdk,
}: RemoteConfigConnection): Partial<FeatureToggles> {
  const toggles: Partial<FeatureToggles> = {};
  for (const key of FEATURE_TOGGLE_KEYS) {
    const value = sdk.getValue(config, key);
    const text = value.asString().trim().toLowerCase();
    if (
      value.getSource() !== 'static' &&
      (text === 'true' || text === 'false')
    ) {
      toggles[key] = text === 'true';
    }
  }
  return toggles;
}
