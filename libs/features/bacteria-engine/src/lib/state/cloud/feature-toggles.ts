import { isObject } from '../is-object';

/**
 * A feature toggle's state (#3194): off for everyone, on for the owner
 * only (`admin`, to try a feature in production first), or on for
 * everyone.
 */
export const TOGGLE_STATES = ['off', 'admin', 'on'] as const;

export type ToggleState = (typeof TOGGLE_STATES)[number];

/**
 * The owner's feature toggles (ADR 0012): Remote Config parameters of the
 * game's project, one state each, set from the admin area through the
 * `toggles.set` command. Their defaults are what the game does without
 * Remote Config, so a client that cannot fetch it plays as before. Pure.
 */
export const FEATURE_TOGGLES = {
  /** Ranked daily attempts are offered. */
  rankedDaily: 'on',
  /** Ranked endless runs are offered. */
  rankedEndless: 'on',
  /** Online matches against a random opponent (the queue). */
  matchmaking: 'on',
  /** The leaderboards are shown. */
  leaderboards: 'on',
  /** Matches run the deterministic simulation where the device can. */
  deterministicSimulation: 'on', // On since the owner's real-device check (ADR 0015).
  /** The main menu's actions are the parts of a 3D bacterium (#3194). */
  bacteriumMenu: 'off',
} as const satisfies Record<string, ToggleState>;

export type FeatureToggle = keyof typeof FEATURE_TOGGLES;

/** Every toggle's state, as the owner set it or defaulted. */
export type FeatureToggleStates = Record<FeatureToggle, ToggleState>;

/** Every toggle resolved for whoever plays: on or off. */
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

export function isToggleState(value: unknown): value is ToggleState {
  return (
    typeof value === 'string' &&
    (TOGGLE_STATES as readonly string[]).includes(value)
  );
}

/**
 * The states a `toggles.set` command sets - null unless it is one or more
 * known toggles, each a state.
 */
export function parseToggleValues(
  value: unknown
): Partial<FeatureToggleStates> | null {
  if (!isObject(value)) {
    return null;
  }
  const entries = Object.entries(value);
  return entries.length > 0 &&
    entries.every(
      ([key, state]) => isFeatureToggle(key) && isToggleState(state)
    )
    ? (Object.fromEntries(entries) as Partial<FeatureToggleStates>)
    : null;
}

/**
 * Every toggle's state, read with `read` (undefined for one that is not
 * set) and falling back to its default.
 */
export function featureToggles(
  read: (toggle: FeatureToggle) => ToggleState | undefined
): FeatureToggleStates {
  return Object.fromEntries(
    FEATURE_TOGGLE_KEYS.map((key) => [key, read(key) ?? FEATURE_TOGGLES[key]])
  ) as FeatureToggleStates;
}

/** Each toggle on or off for a player: `admin` is on for the owner only. */
export function resolveToggles(
  states: FeatureToggleStates,
  isOwner: boolean
): FeatureToggles {
  return Object.fromEntries(
    FEATURE_TOGGLE_KEYS.map((key) => [
      key,
      states[key] === 'on' || (states[key] === 'admin' && isOwner),
    ])
  ) as FeatureToggles;
}

/** The Remote Config texts of the states, see `toggleText`. */
const TOGGLE_TEXTS: Readonly<Record<ToggleState, string>> = {
  on: 'true',
  off: 'false',
  admin: 'admin',
};

/**
 * A state as its Remote Config parameter holds it: `on` and `off` as the
 * booleans every released client reads, `admin` as a text those clients
 * read as unset, their default.
 */
export function toggleText(state: ToggleState): string {
  return TOGGLE_TEXTS[state];
}

/** The state a Remote Config text holds - undefined for any other text. */
export function parseToggleText(text: string): ToggleState | undefined {
  const normal = text.trim().toLowerCase();
  return TOGGLE_STATES.find((state) => TOGGLE_TEXTS[state] === normal);
}
