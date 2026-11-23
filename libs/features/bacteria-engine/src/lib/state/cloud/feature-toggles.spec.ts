import {
  FEATURE_TOGGLES,
  featureToggles,
  parseToggleText,
  parseToggleValues,
  resolveToggles,
  toggleText,
} from './feature-toggles';

describe('feature toggles', () => {
  it('default to what the game does without Remote Config', () => {
    expect(FEATURE_TOGGLES).toEqual({
      rankedDaily: 'on',
      rankedEndless: 'on',
      matchmaking: 'on',
      leaderboards: 'on',
      deterministicSimulation: 'on',
    });
    expect(featureToggles(() => undefined)).toEqual(FEATURE_TOGGLES);
  });

  it('take a state that is set over the default', () => {
    expect(
      featureToggles((toggle) =>
        toggle === 'matchmaking' ? 'admin' : undefined
      )
    ).toEqual({ ...FEATURE_TOGGLES, matchmaking: 'admin' });
  });

  it('read known toggles with states only', () => {
    expect(parseToggleValues({ rankedEndless: 'admin' })).toEqual({
      rankedEndless: 'admin',
    });
    expect(
      parseToggleValues({ rankedEndless: 'off', leaderboards: 'on' })
    ).toEqual({ rankedEndless: 'off', leaderboards: 'on' });
    expect(parseToggleValues({})).toBeNull();
    expect(parseToggleValues({ rankedEndless: false })).toBeNull();
    expect(parseToggleValues({ rankedEndless: 'maybe' })).toBeNull();
    expect(parseToggleValues({ unknown: 'on' })).toBeNull();
    expect(parseToggleValues(['on'])).toBeNull();
  });

  it('resolve admin to on for the owner only', () => {
    const states = {
      ...FEATURE_TOGGLES,
      matchmaking: 'off',
      leaderboards: 'admin',
    } as const;

    expect(resolveToggles(states, false)).toEqual({
      rankedDaily: true,
      rankedEndless: true,
      matchmaking: false,
      leaderboards: false,
      deterministicSimulation: true,
    });
    expect(resolveToggles(states, true)).toMatchObject({
      matchmaking: false,
      leaderboards: true,
    });
  });

  it('store on and off as the booleans released clients read', () => {
    expect(toggleText('on')).toBe('true');
    expect(toggleText('off')).toBe('false');
    expect(toggleText('admin')).toBe('admin');
  });

  it('read every stored text back, and nothing else', () => {
    expect(parseToggleText('true')).toBe('on');
    expect(parseToggleText(' FALSE ')).toBe('off');
    expect(parseToggleText('Admin')).toBe('admin');
    expect(parseToggleText('')).toBeUndefined();
    expect(parseToggleText('on')).toBeUndefined();
    expect(parseToggleText('1')).toBeUndefined();
  });
});
