import { isObject } from './is-object';
import { DETERMINISTIC_SIMULATION } from './simulation';

/**
 * The owner's feature toggles (ADR 0012): Remote Config parameters of the
 * game's project, one boolean each, set from the admin area through the
 * `toggles.set` command. Their defaults are what the game does without
 * Remote Config, so a client that cannot fetch it plays as before. Pure.
 */
export const FEATURE_TOGGLES = {
  /** Ranked daily attempts are offered. */
  rankedDaily: true,
  /** Ranked endless runs are offered. */
  rankedEndless: true,
  /** Online matches against a random opponent (the queue). */
  matchmaking: true,
  /** The leaderboards are shown. */
  leaderboards: true,
  /** Matches run the deterministic simulation where the device can. */
  deterministicSimulation: DETERMINISTIC_SIMULATION,
} as const satisfies Record<string, boolean>;

export type FeatureToggle = keyof typeof FEATURE_TOGGLES;

export type FeatureToggles = Record<FeatureToggle, boolean>;

export const FEATURE_TOGGLE_KEYS = Object.keys(
  FEATURE_TOGGLES
) as FeatureToggle[];

export function isFeatureToggle(value: unknown): value is FeatureToggle {
  return (
    typeof value === 'string' &&
    (FEATURE_TOGGLE_KEYS as readonly string[]).includes(value)
  );
}

/**
 * The values a `toggles.set` command sets - null unless it is one or more
 * known toggles, each a boolean.
 */
export function parseToggleValues(
  value: unknown
): Partial<FeatureToggles> | null {
  if (!isObject(value)) {
    return null;
  }
  const entries = Object.entries(value);
  return entries.length > 0 &&
    entries.every(
      ([key, on]) => isFeatureToggle(key) && typeof on === 'boolean'
    )
    ? (Object.fromEntries(entries) as Partial<FeatureToggles>)
    : null;
}

/**
 * Every toggle, read with `read` (undefined for one that is not set) and
 * falling back to its default.
 */
export function featureToggles(
  read: (toggle: FeatureToggle) => boolean | undefined
): FeatureToggles {
  return Object.fromEntries(
    FEATURE_TOGGLE_KEYS.map((key) => [key, read(key) ?? FEATURE_TOGGLES[key]])
  ) as FeatureToggles;
}
