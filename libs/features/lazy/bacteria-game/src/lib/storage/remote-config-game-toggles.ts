import { defer, map, Observable } from 'rxjs';
import {
  FEATURE_TOGGLE_KEYS,
  type FeatureToggles,
} from '../state/feature-toggles';
import type { RemoteConfigConnection } from './firebase-connection';
import type { GameToggles } from './game-toggles';

/**
 * The feature toggles from the project's Remote Config: one boolean
 * parameter per toggle, under the toggle's name, which the admin command
 * `toggles.set` publishes (ADR 0012). Asks on each `watch`, not before; the
 * connection loads the SDK and fetches once for every caller, and never
 * rejects.
 */
export class RemoteConfigGameToggles implements GameToggles {
  /** `remoteConfig` is `FirebaseConnection.remoteConfig`. */
  public constructor(
    private readonly remoteConfig: () => Promise<RemoteConfigConnection | null>
  ) {}

  public watch(): Observable<Partial<FeatureToggles>> {
    return defer(() => this.remoteConfig()).pipe(
      map((connection) => (connection === null ? {} : readToggles(connection)))
    );
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
