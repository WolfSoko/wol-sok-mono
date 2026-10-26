import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import {
  FLUSH_MS,
  initErrorReports,
  RELEASE,
  runsDeployed,
  scrubEvent,
  withSentry,
} from './error-reports';
import { SENTRY_DSN } from './config';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  flush: jest.fn(async () => true),
}));

const UID = 'Xy3kQ9vLm2PzR7tW5nB8cD4fG6hJ';

describe('error reports', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('initErrorReports', () => {
    it('starts Sentry only in a deployed function', () => {
      expect(runsDeployed({ K_SERVICE: 'acceptreplay' })).toBe(true);
      // The deploy's discovery of the functions, and Jest.
      expect(runsDeployed({})).toBe(false);
      expect(
        runsDeployed({ K_SERVICE: 'acceptreplay', FUNCTIONS_EMULATOR: 'true' })
      ).toBe(false);
      expect(
        runsDeployed({ K_SERVICE: 'acceptreplay', JEST_WORKER_ID: '1' })
      ).toBe(false);

      expect(initErrorReports({})).toBe(false);
      expect(initErrorReports(process.env)).toBe(false);
      expect(Sentry.init).not.toHaveBeenCalled();
    });

    it('reports errors only and no personal data', () => {
      expect(initErrorReports({ K_SERVICE: 'acceptreplay' })).toBe(true);
      const options = jest.mocked(Sentry.init).mock.calls[0]?.[0];
      expect(options).toMatchObject({
        dsn: SENTRY_DSN,
        release: RELEASE,
        environment: 'production',
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
        initialScope: { tags: { function: 'acceptreplay' } },
        beforeSend: scrubEvent,
      });
      expect(options).not.toHaveProperty('tracesSampleRate');
      expect(RELEASE).toMatch(/^bacteria-wars@v\d+\.\d+\.\d+$/);

      const integrations = options?.integrations as (
        defaults: { name: string }[]
      ) => { name: string }[];
      expect(
        integrations(
          ['LinkedErrors', 'Console', 'Http', 'OnUncaughtException'].map(
            (name) => ({ name })
          )
        ).map(({ name }) => name)
      ).toEqual(['LinkedErrors', 'OnUncaughtException']);
    });
  });

  describe('withSentry', () => {
    it('passes a result through without a report', async () => {
      const handler = withSentry(async (a: number, b: number) => a + b);
      await expect(handler(1, 2)).resolves.toBe(3);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('captures, flushes, then rethrows', async () => {
      const order: string[] = [];
      jest.mocked(Sentry.captureException).mockImplementation(() => {
        order.push('capture');
        return 'event';
      });
      jest.mocked(Sentry.flush).mockImplementation(async () => {
        order.push('flush');
        return true;
      });
      const failure = new Error('Firestore is down');
      const handler = withSentry(async () => {
        throw failure;
      });

      await expect(handler()).rejects.toBe(failure);
      expect(Sentry.captureException).toHaveBeenCalledWith(failure);
      expect(Sentry.flush).toHaveBeenCalledWith(FLUSH_MS);
      expect(order).toEqual(['capture', 'flush']);
    });

    it('reports a synchronous throw too', async () => {
      const handler = withSentry((): void => {
        throw new Error('sync');
      });
      await expect(handler()).rejects.toThrow('sync');
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });

  describe('scrubEvent', () => {
    it('drops the user and the request but its path, and ids in messages', () => {
      const event: ErrorEvent = {
        type: undefined,
        user: { id: UID },
        request: {
          url: 'https://bacteria-wars.wolsok.de/replays/abc?page=2',
          headers: { 'x-forwarded-for': '203.0.113.7' },
          cookies: { a: 'b' },
          query_string: 'page=2',
        },
        message: `failed for ${UID}`,
        exception: {
          values: [{ value: `No document: players/${UID}/storage/progress` }],
        },
      };

      expect(scrubEvent(event)).toEqual({
        type: undefined,
        request: { url: 'https://bacteria-wars.wolsok.de/replays/abc' },
        message: 'failed for <id>',
        exception: {
          values: [{ value: 'No document: players/<id>/storage/progress' }],
        },
      });
    });
  });
});
