/** A part of RollaPolla an admin can switch off without a deploy. */
export type FeatureFlag = 'pollCreation' | 'lobbyChat' | 'pollChat';

/** Which features are on. Stored in Firestore as `appConfig/features`. */
export type FeatureToggles = Record<FeatureFlag, boolean>;

type FeatureInfo = {
  flag: FeatureFlag;
  label: string;
  description: string;
};

/**
 * Every feature flag, in the order the admin page lists them. Keep in sync
 * with `featureFlags()` in firestore.rules (app-config.spec.ts checks it).
 */
export const FEATURES: readonly FeatureInfo[] = [
  {
    flag: 'pollCreation',
    label: 'Create polls',
    description: 'Visitors may create new polls.',
  },
  {
    flag: 'lobbyChat',
    label: 'Live chat',
    description: 'The live chat on the home page.',
  },
  {
    flag: 'pollChat',
    label: 'Poll discussions',
    description: 'The discussion below each poll.',
  },
];

/** Everything is on until an admin switches it off. */
export const DEFAULT_FEATURES = Object.fromEntries(
  FEATURES.map(({ flag }) => [flag, true])
) as FeatureToggles;

/** The stored toggles; missing or malformed flags are on. */
export function toFeatureToggles(
  data: Record<string, unknown> | undefined
): FeatureToggles {
  const toggles = { ...DEFAULT_FEATURES };
  for (const { flag } of FEATURES) {
    const stored = data?.[flag];
    if (typeof stored === 'boolean') {
      toggles[flag] = stored;
    }
  }
  return toggles;
}
