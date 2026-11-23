import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import { logger } from 'firebase-functions/logger';
import { logCaughtError, reportCaughtErrorsTo } from './caught-errors';
import {
  CAUGHT_PER_MESSAGE,
  captureCaughtError,
  FLUSH_MS,
  initErrorReports,
  RELEASE,
  runsDeployed,
  scrubEvent,
  scrubIds,
  withSentry,
} from './error-reports';
import { SENTRY_DSN } from './config';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  flush: jest.fn(async () => true),
}));
jest.mock('firebase-functions/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));

const UID = 'Xy3kQ9vLm2PzR7tW5nB8cD4fG6hJ';

describe('error reports', () => {
  beforeEach(() => jest.clearAllMocks());
  // The sink is module state: no suite reports into the next.
  afterEach(() => reportCaughtErrorsTo(null));

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

      const error = new Error('caught');
      logCaughtError('Could not lift an ended ban', { error });
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { caught: 'Could not lift an ended ban' },
      });
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
      expect(Sentry.flush).not.toHaveBeenCalled();
    });

    it('flushes what a batch caught before it returns', async () => {
      const order: string[] = [];
      jest.mocked(Sentry.captureException).mockImplementation(() => {
        order.push('capture');
        return 'event';
      });
      jest.mocked(Sentry.flush).mockImplementation(async () => {
        order.push('flush');
        return true;
      });
      const error = new Error('one guest');
      const handler = withSentry(async () => {
        captureCaughtError(error, 'Could not erase an idle guest');
        order.push('return');
        return 'swept';
      });

      await expect(handler()).resolves.toBe('swept');
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        tags: { caught: 'Could not erase an idle guest' },
      });
      expect(Sentry.flush).toHaveBeenCalledWith(FLUSH_MS);
      expect(order).toEqual(['capture', 'return', 'flush']);
    });

    it('reports a run at most a few of each caught message, and counts the rest', async () => {
      const extra = 3;
      const handler = withSentry(async () => {
        for (let i = 0; i < CAUGHT_PER_MESSAGE + extra; i++) {
          captureCaughtError(
            new Error(`guest ${i}`),
            'Could not erase an idle guest'
          );
        }
        captureCaughtError(new Error('ban'), 'Could not lift an ended ban');
      });

      await handler();
      expect(Sentry.captureException).toHaveBeenCalledTimes(
        CAUGHT_PER_MESSAGE + 1
      );
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        'Caught errors not reported to Sentry',
        { skipped: { 'Could not erase an idle guest': extra } }
      );

      // The next run starts its own count.
      jest.clearAllMocks();
      await withSentry(async () =>
        captureCaughtError(new Error('again'), 'Could not erase an idle guest')
      )();
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('keeps the counts of runs at the same time apart', async () => {
      let release = () => undefined as void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const fill = withSentry(async () => {
        for (let i = 0; i < CAUGHT_PER_MESSAGE; i++) {
          captureCaughtError(new Error(`${i}`), 'Could not close a replay');
        }
        await gate;
      });
      const other = withSentry(async () =>
        captureCaughtError(new Error('other run'), 'Could not close a replay')
      );

      const first = fill();
      await other();
      release();
      await first;
      expect(Sentry.captureException).toHaveBeenCalledTimes(
        CAUGHT_PER_MESSAGE + 1
      );
      expect(logger.warn).not.toHaveBeenCalled();
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

  describe('scrubIds', () => {
    it('replaces a uid or an auto-id without a digit too, not numbers or long names', () => {
      expect(
        scrubIds(
          'players/AbcdefGhijkLmnopQrstuVwxyzAb/friends/abcdefGhijkLmnopQrst'
        )
      ).toBe('players/<id>/friends/<id>');
      expect(
        scrubIds(
          '12345678901234567890 ExpressionChangedAfterItHasBeenCheckedError'
        )
      ).toBe(
        '12345678901234567890 ExpressionChangedAfterItHasBeenCheckedError'
      );
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
