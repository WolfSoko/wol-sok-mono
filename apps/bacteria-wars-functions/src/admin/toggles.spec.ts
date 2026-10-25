import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FEATURE_TOGGLE_KEYS,
  FEATURE_TOGGLES,
} from '@wolsok/feat-lazy-bac-game/engine';
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
          matchmaking: { defaultValue: { value: 'false' } },
          leaderboards: { defaultValue: { useInAppDefault: true } },
        })
      )
    ).toEqual({ ...FEATURE_TOGGLES, matchmaking: false });
  });

  it('set a boolean default and drop conditions, leaving other parameters', () => {
    const set = withToggles(
      template({
        rankedDaily: {
          defaultValue: { value: 'true' },
          conditionalValues: { beta: { value: 'false' } },
        },
        other: { defaultValue: { value: 'x' } },
      }),
      { rankedDaily: false }
    );
    expect(set.parameters['rankedDaily']).toMatchObject({
      defaultValue: { value: 'false' },
      valueType: 'BOOLEAN',
    });
    expect(set.parameters['rankedDaily']?.conditionalValues).toBeUndefined();
    expect(set.parameters['other']).toEqual({ defaultValue: { value: 'x' } });
    expect(set.etag).toBe('e1');
  });

  it('are the ones the rules let a command set', () => {
    const rules = readFileSync(
      join(__dirname, '../../../bacteria-game-remote/firestore.rules'),
      'utf8'
    );
    const body = rules.slice(rules.indexOf('args.values.keys().hasOnly(['));
    const listed = body
      .slice(0, body.indexOf('])'))
      .match(/'[A-Za-z]+'/g)
      ?.map((key) => key.slice(1, -1));
    expect(listed).toEqual(FEATURE_TOGGLE_KEYS);
  });
});
