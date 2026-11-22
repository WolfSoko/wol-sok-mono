import { FEATURE_TOGGLES } from '@wolsok/feat-shared-bacteria-engine/cloud';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import {
  getRemoteConfig,
  type RemoteConfig,
  type RemoteConfigTemplate,
} from 'firebase-admin/remote-config';
import { remoteTogglesOf, setToggles, togglesOf, withToggles } from './toggles';

/** Remote Config on an app without credentials: it only builds templates. */
const app = initializeApp({ projectId: 'demo-toggles' }, 'toggles-spec');
const remoteConfig = getRemoteConfig(app);
afterAll(() => deleteApp(app));

/**
 * A template as the Admin SDK hands it out: its class, whose `etag` is a
 * getter (#3212), not a plain object.
 */
const template = (
  parameters: RemoteConfigTemplate['parameters'],
  parameterGroups: RemoteConfigTemplate['parameterGroups'] = {}
): RemoteConfigTemplate =>
  remoteConfig.createTemplateFromJSON(
    JSON.stringify({ conditions: [], parameters, parameterGroups, etag: 'e1' })
  );

/** What the SDK sends on publish, its HTTP request stubbed. */
interface PutRequest {
  (template: RemoteConfigTemplate, etag: string): Promise<unknown>;
}

function stubbedPublish(
  config: RemoteConfig
): jest.Mock<ReturnType<PutRequest>, Parameters<PutRequest>> {
  const client = (
    config as unknown as { client: { sendPutRequest: PutRequest } }
  ).client;
  const put = jest.fn<ReturnType<PutRequest>, Parameters<PutRequest>>(
    async (sent) => ({
      headers: { etag: 'e2' },
      data: {
        conditions: sent.conditions,
        parameters: sent.parameters,
        parameterGroups: sent.parameterGroups,
      },
    })
  );
  client.sendPutRequest = put;
  return put;
}

describe('the toggles in a Remote Config template', () => {
  it('read their defaults where the template does not set them', () => {
    expect(togglesOf(template({}))).toEqual(FEATURE_TOGGLES);
    expect(
      togglesOf(
        template({
          matchmaking: { defaultValue: { value: 'FALSE' } },
          leaderboards: { defaultValue: { useInAppDefault: true } },
          rankedDaily: { defaultValue: { value: 'maybe' } },
          bacteriumMenu: { defaultValue: { value: 'admin' } },
          rankedEndless: { defaultValue: { value: 'true' } },
        })
      )
    ).toEqual({
      ...FEATURE_TOGGLES,
      matchmaking: 'off',
      bacteriumMenu: 'admin',
      rankedEndless: 'on',
    });
  });

  it('set a text default and drop conditions, in a copy', () => {
    const original = template({
      rankedDaily: {
        defaultValue: { value: 'true' },
        conditionalValues: { beta: { value: 'false' } },
      },
      other: { defaultValue: { value: 'x' } },
    });
    const set = withToggles(original, {
      rankedDaily: 'off',
      bacteriumMenu: 'admin',
    });
    expect(set.parameters['rankedDaily']).toMatchObject({
      defaultValue: { value: 'false' },
      valueType: 'STRING',
    });
    expect(set.parameters['bacteriumMenu']).toMatchObject({
      defaultValue: { value: 'admin' },
      valueType: 'STRING',
    });
    expect(set.parameters['rankedDaily']?.conditionalValues).toBeUndefined();
    expect(set.parameters['other']).toEqual({ defaultValue: { value: 'x' } });
    expect(set.etag).toBe('e1');
    expect(original.parameters['rankedDaily']?.defaultValue).toEqual({
      value: 'true',
    });
  });

  it('stay in the parameter group the owner put them in', () => {
    const grouped = template(
      {},
      {
        game: {
          parameters: { matchmaking: { defaultValue: { value: 'false' } } },
        },
      }
    );
    expect(togglesOf(grouped).matchmaking).toBe('off');
    const set = withToggles(grouped, { matchmaking: 'on' });
    expect(set.parameters['matchmaking']).toBeUndefined();
    expect(
      set.parameterGroups['game']?.parameters['matchmaking']?.defaultValue
    ).toEqual({ value: 'true' });
  });
});

describe('setting toggles in Remote Config', () => {
  it('publishes the template it read, with its ETag (#3212)', async () => {
    const put = stubbedPublish(remoteConfig);
    const toggles = remoteTogglesOf(
      async () =>
        ({
          getTemplate: async () =>
            template({ rankedDaily: { defaultValue: { value: 'true' } } }),
          publishTemplate: (sent: RemoteConfigTemplate) =>
            remoteConfig.publishTemplate(sent),
        }) as unknown as RemoteConfig
    );

    await toggles.update(() => ({ bacteriumMenu: 'admin' }));

    expect(put).toHaveBeenCalledTimes(1);
    const [sent, etag] = put.mock.calls[0];
    expect(etag).toBe('e1');
    expect(sent.parameters['bacteriumMenu']?.defaultValue).toEqual({
      value: 'admin',
    });
    expect(sent.parameters['rankedDaily']?.defaultValue).toEqual({
      value: 'true',
    });
  });

  it('publishes only the toggle the owner changed, so no other one flips', async () => {
    const put = stubbedPublish(remoteConfig);
    const toggles = remoteTogglesOf(
      async () =>
        ({
          getTemplate: async () => template({}),
          publishTemplate: (sent: RemoteConfigTemplate) =>
            remoteConfig.publishTemplate(sent),
        }) as unknown as RemoteConfig
    );

    await setToggles(toggles, { ...FEATURE_TOGGLES, bacteriumMenu: 'admin' });

    const [sent] = put.mock.calls[0];
    expect(Object.keys(sent.parameters)).toEqual(['bacteriumMenu']);
  });
});
