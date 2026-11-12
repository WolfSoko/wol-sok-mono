import { REGION } from './config';
import * as main from './main';

interface Endpoint {
  region?: string[];
  eventTrigger?: { eventType: string; retry: boolean };
  scheduleTrigger?: { schedule: string; retryConfig?: { retryCount?: number } };
  timeoutSeconds?: number;
  maxInstances?: number;
}

const endpointOf = (fn: unknown): Endpoint =>
  (fn as { __endpoint: Endpoint }).__endpoint;

describe('the deployed functions', () => {
  // the trigger names its resource by the project Firebase deploys it to
  beforeAll(() => {
    process.env['GCLOUD_PROJECT'] = 'demo-korbjaeger';
  });

  afterAll(() => {
    delete process.env['GCLOUD_PROJECT'];
  });

  // `--force` deletes a function of the codebase that is gone from here
  it('are the Auth deletion trigger and the club index', () => {
    expect(Object.keys(main)).toEqual(['deleteSelection', 'clubIndex']);
  });

  it('crawl the club index hourly, next to the database, one at a time, unretried', () => {
    expect(endpointOf(main.clubIndex)).toMatchObject({
      region: [REGION],
      scheduleTrigger: {
        schedule: '23 * * * *',
        retryConfig: { retryCount: 0 },
      },
      timeoutSeconds: 1800,
      maxInstances: 1,
    });
  });

  it('delete the selection on every Auth deletion, next to the database, retried until it succeeds', () => {
    expect(endpointOf(main.deleteSelection)).toMatchObject({
      region: [REGION],
      eventTrigger: {
        eventType: 'providers/firebase.auth/eventTypes/user.delete',
        retry: true,
      },
    });
  });
});
