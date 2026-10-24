import { REGION } from './config';

/** The part of a function's manifest entry the specs read. */
interface ManifestEndpoint {
  region?: string[];
  cpu?: number | string;
  availableMemoryMb?: number;
  timeoutSeconds?: number;
  maxInstances?: number;
  concurrency?: number;
  secretEnvironmentVariables?: { key: string }[];
  eventTrigger?: {
    eventType: string;
    retry?: boolean;
    eventFilterPathPatterns?: Record<string, string>;
  };
  scheduleTrigger?: {
    schedule: string;
    timeZone?: string;
    retryConfig?: { retryCount?: number };
  };
}

/** What the deploy reads off each exported function. */
type Exported = Record<string, { __endpoint: ManifestEndpoint }>;

describe('the exported functions', () => {
  let functions: Exported;

  beforeAll(async () => {
    // A v1 Auth trigger names its project when it is read.
    process.env['GCLOUD_PROJECT'] ??= 'demo-bacteria-wars';
    functions = (await import('./main')) as unknown as Exported;
  });

  it('are the ones of ADR 0011 and ADR 0012, and no more', () => {
    expect(Object.keys(functions).sort()).toEqual([
      'acceptReplay',
      'adminCommand',
      'boardProfileChanged',
      'countAccount',
      'deletePlayerBoards',
      'deletePlayerReplays',
      'featureBest',
      'hourly',
      'profileChanged',
      'rankProgress',
      'rankReplay',
      'rebuildTop',
      'replayCommand',
    ]);
  });

  it('all run in the one region, without retries', () => {
    for (const [name, { __endpoint }] of Object.entries(functions)) {
      expect([name, __endpoint.region]).toEqual([name, [REGION]]);
      const retry =
        __endpoint.eventTrigger?.retry ??
        __endpoint.scheduleTrigger?.retryConfig?.retryCount;
      const scheduled = name === 'featureBest' || name === 'hourly';
      expect([name, retry]).toEqual([name, scheduled ? 0 : false]);
    }
  });

  it('trigger on the documents of ADR 0011', () => {
    const path = (name: string) =>
      functions[name].__endpoint.eventTrigger?.eventFilterPathPatterns?.[
        'document'
      ];
    expect(path('acceptReplay')).toBe('replaySubmissions/{id}');
    expect(path('replayCommand')).toBe('replayCommands/{id}');
    expect(path('profileChanged')).toBe('profiles/{uid}');
    expect(functions['replayCommand'].__endpoint.eventTrigger?.eventType).toBe(
      'google.cloud.firestore.document.v1.created.withAuthContext'
    );
    expect(
      functions['deletePlayerReplays'].__endpoint.eventTrigger?.eventType
    ).toBe('providers/firebase.auth/eventTypes/user.delete');
  });

  it('trigger on the documents of ADR 0012', () => {
    const trigger = (name: string) => functions[name].__endpoint.eventTrigger;
    const path = (name: string) =>
      trigger(name)?.eventFilterPathPatterns?.['document'];
    expect(path('rankReplay')).toBe('replays/{id}');
    expect(path('rankProgress')).toBe(
      'players/{uid}/storage/bacteria-game.progress'
    );
    expect(path('rebuildTop')).toBe('boards/{boardId}/entries/{entryId}');
    expect(path('boardProfileChanged')).toBe('profiles/{uid}');
    expect(path('adminCommand')).toBe('adminCommands/{id}');
    expect(trigger('adminCommand')?.eventType).toBe(
      'google.cloud.firestore.document.v1.created.withAuthContext'
    );
    expect(trigger('countAccount')?.eventType).toBe(
      'providers/firebase.auth/eventTypes/user.create'
    );
    expect(trigger('deletePlayerBoards')?.eventType).toBe(
      'providers/firebase.auth/eventTypes/user.delete'
    );
  });

  it('rebuild a top document one at a time', () => {
    const { maxInstances, concurrency } = functions['rebuildTop'].__endpoint;
    expect(maxInstances).toBe(1);
    expect(concurrency).toBe(1);
  });

  it('read the tombstone key from Secret Manager', () => {
    for (const name of [
      'acceptReplay',
      'rankProgress',
      'adminCommand',
      'countAccount',
      'deletePlayerBoards',
      'hourly',
    ]) {
      expect([
        name,
        functions[name].__endpoint.secretEnvironmentVariables,
      ]).toEqual([
        name,
        [expect.objectContaining({ key: 'BAN_TOMBSTONE_KEY' })],
      ]);
    }
  });

  it('schedule hourly at minute 17 (UTC), 1 GiB, one instance, paused', async () => {
    const { scheduleTrigger, timeoutSeconds, maxInstances, availableMemoryMb } =
      functions['hourly'].__endpoint;
    expect(scheduleTrigger?.schedule).toBe('17 * * * *');
    expect(scheduleTrigger?.timeZone).toBe('UTC');
    expect(timeoutSeconds).toBe(1800);
    expect(maxInstances).toBe(1);
    expect(availableMemoryMb).toBe(1024);
    const { HOURLY_ENABLED, FEATURE_BEST_ENABLED } = await import('./config');
    expect(HOURLY_ENABLED).toBe(false);
    expect(FEATURE_BEST_ENABLED).toBe(false);
  });

  it('keep the light triggers on a fraction of a vCPU', () => {
    for (const name of [
      'acceptReplay',
      'profileChanged',
      'rankReplay',
      'rankProgress',
      'rebuildTop',
      'boardProfileChanged',
    ]) {
      expect(functions[name].__endpoint.cpu).toBe('gcf_gen1');
      expect(functions[name].__endpoint.availableMemoryMb).toBe(256);
    }
  });

  it('schedule featureBest daily at 04:00 in Berlin, one instance', () => {
    const { scheduleTrigger, timeoutSeconds, maxInstances } =
      functions['featureBest'].__endpoint;
    expect(scheduleTrigger?.schedule).toBe('0 4 * * *');
    expect(scheduleTrigger?.timeZone).toBe('Europe/Berlin');
    expect(timeoutSeconds).toBe(1800);
    expect(maxInstances).toBe(1);
  });
});
