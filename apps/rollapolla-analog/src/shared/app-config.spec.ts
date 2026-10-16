import rules from '../../firestore.rules?raw';
import { DEFAULT_FEATURES, FEATURES, toFeatureToggles } from './app-config';

describe('app config', () => {
  it('turns every feature on by default', () => {
    expect(toFeatureToggles(undefined)).toEqual(DEFAULT_FEATURES);
    expect(Object.values(DEFAULT_FEATURES).every(Boolean)).toBe(true);
  });

  it('takes the stored flags and ignores malformed or unknown ones', () => {
    expect(
      toFeatureToggles({ lobbyChat: false, pollChat: 'no', other: false })
    ).toEqual({ ...DEFAULT_FEATURES, lobbyChat: false });
  });

  it('lists every flag the rules accept, and only those', () => {
    const listed = /function featureFlags\(\) \{\s*return \[([^\]]*)\];/.exec(
      rules
    )?.[1];
    const ruleFlags = [...(listed ?? '').matchAll(/'([^']+)'/g)].map(
      ([, flag]) => flag
    );

    expect(ruleFlags).toEqual(FEATURES.map(({ flag }) => flag));
    expect(Object.keys(DEFAULT_FEATURES)).toEqual(ruleFlags);
  });
});
