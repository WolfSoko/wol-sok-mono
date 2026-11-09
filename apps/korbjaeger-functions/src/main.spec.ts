import { REGION } from './config';
import * as main from './main';

interface Endpoint {
  region?: string[];
  eventTrigger?: { eventType: string; retry: boolean };
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
  it('are the Auth deletion trigger only', () => {
    expect(Object.keys(main)).toEqual(['auswahlLoeschen']);
  });

  it('delete the Auswahl on every Auth deletion, next to the database, retried until it succeeds', () => {
    expect(endpointOf(main.auswahlLoeschen)).toMatchObject({
      region: [REGION],
      eventTrigger: {
        eventType: 'providers/firebase.auth/eventTypes/user.delete',
        retry: true,
      },
    });
  });
});
