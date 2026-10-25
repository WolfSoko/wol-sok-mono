import { rankDaily } from './boards/rank-daily';
import { rankOnline } from './boards/rank-online';

jest.mock('./boards/rank-daily', () => ({
  ...jest.requireActual('./boards/rank-daily'),
  rankDaily: jest.fn(async () => 'counted'),
}));
jest.mock('./boards/rank-online', () => ({
  ...jest.requireActual('./boards/rank-online'),
  rankOnline: jest.fn(async () => 'counted'),
}));

/** The part of a function's manifest entry the specs read. */
interface Endpoint {
  eventTrigger?: { retry?: boolean };
  scheduleTrigger?: { retryConfig?: { retryCount?: number } };
}

/** The part of a written document's event `rankReplay` reads. */
interface WrittenEvent {
  time: string;
  params: { id: string };
  data: {
    before: { data: () => Record<string, unknown> | undefined };
    after: { data: () => Record<string, unknown> | undefined };
  };
}

describe('the exported functions', () => {
  let functions: Record<
    string,
    { __endpoint: Endpoint; run: (event: WrittenEvent) => unknown } | undefined
  >;

  beforeAll(async () => {
    // A v1 Auth trigger names its project when it is read.
    process.env['GCLOUD_PROJECT'] ??= 'demo-bacteria-functions';
    functions = (await import('./main')) as unknown as typeof functions;
  });

  it('retry only where a lost event would lose a count, or is safe', () => {
    const retrying = Object.entries(functions)
      .filter(([, fn]) => fn?.__endpoint.eventTrigger?.retry === true)
      .map(([name]) => name)
      .sort();
    // rankReplay: a stored replay it fails to rank would never count.
    // rebuildTop: a busy instance turns events away, and a rebuild is safe.
    expect(retrying).toEqual(['rankReplay', 'rebuildTop']);
  });

  it('never retry the hourly run', () => {
    expect(
      functions['hourly']?.__endpoint.scheduleTrigger?.retryConfig?.retryCount
    ).toBe(0);
  });

  describe('rankReplay', () => {
    // Delivered again 40 minutes after the write.
    const written = Date.now() - 40 * 60_000;
    const event = (
      before: Record<string, unknown> | undefined,
      after: Record<string, unknown>
    ): WrittenEvent => ({
      time: new Date(written).toISOString(),
      params: { id: 'r1' },
      data: { before: { data: () => before }, after: { data: () => after } },
    });

    it('ranks an online match at the time of the event', async () => {
      const after = { kind: 'online', state: 'agreed' };
      await functions['rankReplay']?.run(
        event({ kind: 'online', state: 'waiting' }, after)
      );
      expect(rankOnline).toHaveBeenCalledWith(
        expect.anything(),
        'r1',
        after,
        expect.any(Function),
        written
      );
    });

    it('ranks a daily attempt at the time of the event', async () => {
      const after = { kind: 'daily', attempt: { id: 'd_2026-10-25_1' } };
      await functions['rankReplay']?.run(event(undefined, after));
      expect(rankDaily).toHaveBeenCalledWith(
        expect.anything(),
        'r1',
        after,
        written
      );
    });
  });
});
