import { FEATURE_TOGGLES } from '@wolsok/feat-lazy-bac-game/engine';
import type { RemoteConfigTemplate } from 'firebase-admin/remote-config';
import { togglesOf, withToggles } from './toggles';

const template = (
  parameters: RemoteConfigTemplate['parameters']
): RemoteConfigTemplate =>
  ({
    conditions: [],
    parameters,
    parameterGroups: {},
    etag: 'e1',
  }) as RemoteConfigTemplate;

describe('the toggles in a Remote Config template', () => {
  it('read their defaults where the template does not set them', () => {
    expect(togglesOf(template({}))).toEqual(FEATURE_TOGGLES);
    expect(
      togglesOf(
        template({
          matchmaking: { defaultValue: { value: 'FALSE' } },
          leaderboards: { defaultValue: { useInAppDefault: true } },
          rankedDaily: { defaultValue: { value: 'maybe' } },
        })
      )
    ).toEqual({ ...FEATURE_TOGGLES, matchmaking: false });
  });

  it('set a boolean default and drop conditions, in a copy', () => {
    const original = template({
      rankedDaily: {
        defaultValue: { value: 'true' },
        conditionalValues: { beta: { value: 'false' } },
      },
      other: { defaultValue: { value: 'x' } },
    });
    const set = withToggles(original, { rankedDaily: false });
    expect(set.parameters['rankedDaily']).toMatchObject({
      defaultValue: { value: 'false' },
      valueType: 'BOOLEAN',
    });
    expect(set.parameters['rankedDaily']?.conditionalValues).toBeUndefined();
    expect(set.parameters['other']).toEqual({ defaultValue: { value: 'x' } });
    expect(set.etag).toBe('e1');
    expect(original.parameters['rankedDaily']?.defaultValue).toEqual({
      value: 'true',
    });
  });

  it('stay in the parameter group the owner put them in', () => {
    const grouped = {
      ...template({}),
      parameterGroups: {
        game: {
          parameters: { matchmaking: { defaultValue: { value: 'false' } } },
        },
      },
    } as RemoteConfigTemplate;
    expect(togglesOf(grouped).matchmaking).toBe(false);
    const set = withToggles(grouped, { matchmaking: true });
    expect(set.parameters['matchmaking']).toBeUndefined();
    expect(
      set.parameterGroups['game']?.parameters['matchmaking']?.defaultValue
    ).toEqual({ value: 'true' });
  });
});
