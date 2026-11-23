import { defer, map, Observable } from 'rxjs';
import {
  FEATURE_TOGGLE_KEYS,
  type FeatureToggleStates,
  parseToggleText,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { RemoteConfigConnection } from './firebase-connection';
import type { GameToggles } from './game-toggles';

/**
 * The feature toggles from the project's Remote Config: one parameter per
 * toggle, its state as `toggleText` writes it, under the toggle's name, which the admin command
 * `toggles.set` publishes (ADR 0012). Asks on each `watch`, not before; the
 * connection loads the SDK and fetches once for every caller, and never
 * rejects.
 */
export class RemoteConfigGameToggles implements GameToggles {
  /** `remoteConfig` is `FirebaseConnection.remoteConfig`. */
  public constructor(
    private readonly remoteConfig: () => Promise<RemoteConfigConnection | null>
  ) {}

  public watch(): Observable<Partial<FeatureToggleStates>> {
    return defer(() => this.remoteConfig()).pipe(
      map((connection) => (connection === null ? {} : readToggles(connection)))
    );
  }
}

/**
 * The toggles' states Remote Config holds. A parameter it does not hold
 * reads as the SDK's static value, and a text that is no state the admin
 * area would publish ("true", "false", "admin") is none: both are left
 * out, so the toggle keeps its default.
 */
export function readToggles({
  config,
  sdk,
}: RemoteConfigConnection): Partial<FeatureToggleStates> {
  const toggles: Partial<FeatureToggleStates> = {};
  for (const key of FEATURE_TOGGLE_KEYS) {
    const value = sdk.getValue(config, key);
    const state =
      value.getSource() === 'static'
        ? undefined
        : parseToggleText(value.asString());
    if (state !== undefined) {
      toggles[key] = state;
    }
  }
  return toggles;
}
