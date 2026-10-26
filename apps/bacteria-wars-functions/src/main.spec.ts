import { rankDaily } from './boards/rank-daily';
import { rankOnline } from './boards/rank-online';
import { acceptSubmission, giveUpSubmission } from './replays/accept';
import { checkGoogleLink } from './admin/tombstones';

jest.mock('./boards/rank-daily', () => ({
  ...jest.requireActual('./boards/rank-daily'),
  rankDaily: jest.fn(async () => 'counted'),
}));
jest.mock('./boards/rank-online', () => ({
  ...jest.requireActual('./boards/rank-online'),
  rankOnline: jest.fn(async () => 'counted'),
}));
jest.mock('./admin/tombstones', () => ({
  ...jest.requireActual('./admin/tombstones'),
  checkGoogleLink: jest.fn(async () => false),
}));
jest.mock('./replays/accept', () => ({
  acceptSubmission: jest.fn(async () => 'stored'),
  giveUpSubmission: jest.fn(async () => undefined),
}));
/** The replay as `rankReplay` reads it afresh - undefined when gone. */
let mockStoredReplay: Record<string, unknown> | undefined;
jest.mock('firebase-admin/firestore', () => ({
  ...jest.requireActual('firebase-admin/firestore'),
  getFirestore: () => ({
    doc: () => ({ get: async () => ({ data: () => mockStoredReplay }) }),
  }),
}));

/** The part of a function's manifest entry the specs read. */
interface Endpoint {
  eventTrigger?: { retry?: boolean };
  scheduleTrigger?: { retryConfig?: { retryCount?: number } };
}

/** The part of a created document's event `acceptReplay` reads. */
interface CreatedEvent {
  time: string;
  params: { id: string };
  data: { data: () => Record<string, unknown> | undefined };
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
    | {
        __endpoint: Endpoint;
        run: (event: WrittenEvent | CreatedEvent) => unknown;
      }
    | undefined
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
    // acceptReplay: a failure of ours would lose a replay, and an attempt.
    // rankReplay: a stored replay it fails to rank would never count.
    // rebuildTop: a busy instance turns events away, and a rebuild is safe.
    // mirrorFriend, mirrorRequest: a lost event leaves the mirror wrong, and
    // the handler reads the list entry afresh.
    expect(retrying).toEqual([
      'acceptReplay',
      'mirrorFriend',
      'mirrorRequest',
      'rankReplay',
      'rebuildTop',
    ]);
  });

  it('never retry the hourly run or the guest clean-up', () => {
    for (const name of ['hourly', 'guestCleanup']) {
      expect([
        name,
        functions[name]?.__endpoint.scheduleTrigger?.retryConfig?.retryCount,
      ]).toEqual([name, 0]);
    }
  });

  describe('acceptReplay', () => {
    const submission = { uid: 'ada', attempt: 'd_2026-10-25_1' };
    const created = (minutesAgo: number): CreatedEvent => ({
      time: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      params: { id: 's1' },
      data: { data: () => submission },
    });

    beforeEach(() => jest.clearAllMocks());

    it('accepts a submission for an hour', async () => {
      await functions['acceptReplay']?.run(created(40));
      // After the one-time check of a Google link.
      expect(checkGoogleLink).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'ada',
        expect.any(Function),
        expect.any(Number)
      );
      expect(acceptSubmission).toHaveBeenCalledWith(
        expect.anything(),
        's1',
        submission,
        expect.any(Number)
      );
      expect(giveUpSubmission).not.toHaveBeenCalled();
    });

    it('then gives up, which voids its attempt', async () => {
      await functions['acceptReplay']?.run(created(61));
      expect(giveUpSubmission).toHaveBeenCalledWith(
        expect.anything(),
        's1',
        submission,
        expect.any(Number)
      );
      expect(acceptSubmission).not.toHaveBeenCalled();
    });
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

    beforeEach(() => jest.clearAllMocks());

    it('ranks an online match at the time of the event', async () => {
      const after = { kind: 'online', state: 'agreed' };
      mockStoredReplay = after;
      await functions['rankReplay']?.run(
        event({ kind: 'online', state: 'waiting' }, after)
      );
      expect(rankOnline).toHaveBeenCalledWith(
        expect.anything(),
        'r1',
        expect.any(Function),
        written
      );
    });

    it('ranks a daily attempt as stored, at the time of the event', async () => {
      const after = { kind: 'daily', attempt: { id: 'd_2026-10-25_1' } };
      mockStoredReplay = { ...after, players: ['ada'] };
      await functions['rankReplay']?.run(event(undefined, after));
      expect(rankDaily).toHaveBeenCalledWith(
        expect.anything(),
        'r1',
        mockStoredReplay,
        written
      );
    });

    it('leaves a replay that is gone or answered by an earlier delivery', async () => {
      const daily = { kind: 'daily', attempt: { id: 'd_2026-10-25_1' } };
      const online = { kind: 'online', state: 'agreed' };
      for (const stored of [
        undefined,
        { ...daily, rankedReason: 'counted' },
        { ...online, rankedReason: 'pair-cap' },
      ]) {
        mockStoredReplay = stored;
        await functions['rankReplay']?.run(event(undefined, daily));
        await functions['rankReplay']?.run(
          event({ ...online, state: 'waiting' }, online)
        );
      }
      expect(rankDaily).not.toHaveBeenCalled();
      expect(rankOnline).not.toHaveBeenCalled();
    });

    it('drops an event older than an hour', async () => {
      mockStoredReplay = { kind: 'daily', attempt: { id: 'd_2026-10-25_1' } };
      await functions['rankReplay']?.run({
        ...event(undefined, mockStoredReplay),
        time: new Date(Date.now() - 61 * 60_000).toISOString(),
      });
      expect(rankDaily).not.toHaveBeenCalled();
    });
  });
});
