import {
  FEATURE_TOGGLES,
  featureToggles,
  parseToggleValues,
} from './feature-toggles';

describe('feature toggles', () => {
  it('default to what the game does without Remote Config', () => {
    expect(FEATURE_TOGGLES).toEqual({
      rankedDaily: true,
      rankedEndless: true,
      matchmaking: true,
      leaderboards: true,
      deterministicSimulation: true,
    });
    expect(featureToggles(() => undefined)).toEqual(FEATURE_TOGGLES);
  });

  it('take a value that is set over the default', () => {
    expect(
      featureToggles((toggle) => (toggle === 'matchmaking' ? false : undefined))
    ).toEqual({ ...FEATURE_TOGGLES, matchmaking: false });
  });

  it('read known toggles with booleans only', () => {
    expect(parseToggleValues({ rankedEndless: false })).toEqual({
      rankedEndless: false,
    });
    expect(parseToggleValues({})).toBeNull();
    expect(parseToggleValues({ rankedEndless: 0 })).toBeNull();
    expect(parseToggleValues({ unknown: true })).toBeNull();
    expect(parseToggleValues([true])).toBeNull();
  });
});
