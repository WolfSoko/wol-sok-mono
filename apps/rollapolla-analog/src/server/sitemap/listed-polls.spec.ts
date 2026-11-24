import { getDocs, limit, orderBy, query, where } from 'firebase/firestore/lite';
import { listedPolls } from './listed-polls';

vi.mock('firebase/app', () => ({
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'sitemap' })),
}));

vi.mock('firebase/firestore/lite', () => ({
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  connectFirestoreEmulator: vi.fn(),
  getDocs: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  limit: vi.fn((count: number) => ({ limit: count })),
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({
    ref,
    constraints,
  })),
  where: vi.fn((field: string, op: string, value: unknown) => ({
    field,
    op,
    value,
  })),
}));

type StoredPoll = { id: string; ttl?: Date };

function snapshotOf(polls: readonly StoredPoll[]) {
  return {
    docs: polls.map(({ id, ttl }) => ({
      id,
      data: () => (ttl ? { ttl: { toDate: () => ttl } } : {}),
    })),
  };
}

describe('listedPolls', () => {
  beforeEach(() => {
    vi.mocked(getDocs).mockReset();
  });

  it('asks Firestore for the newest listed polls', async () => {
    vi.mocked(getDocs).mockResolvedValue(snapshotOf([]) as never);

    await listedPolls();

    expect(query).toHaveBeenCalledWith(
      { path: 'polls' },
      where('listed', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );
  });

  it('maps a newly created listed poll to its id and closing time', async () => {
    const closesAt = new Date('2026-12-24T09:00:00Z');
    vi.mocked(getDocs).mockResolvedValue(
      snapshotOf([{ id: 'new-poll', ttl: closesAt }]) as never
    );

    await expect(listedPolls()).resolves.toEqual([
      { id: 'new-poll', closesAt },
    ]);
  });

  it('skips a poll without ttl and keeps the others', async () => {
    const closesAt = new Date('2026-12-24T09:00:00Z');
    vi.mocked(getDocs).mockResolvedValue(
      snapshotOf([{ id: 'broken' }, { id: 'fine', ttl: closesAt }]) as never
    );

    await expect(listedPolls()).resolves.toEqual([{ id: 'fine', closesAt }]);
  });

  it('gives up when Firestore does not answer within 5 seconds', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(getDocs).mockReturnValue(new Promise(() => undefined));

      // settle the rejection right away, so it is never unhandled meanwhile
      const outcome = listedPolls().catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(5000);

      expect(await outcome).toEqual(new Error('no answer within 5000 ms'));
    } finally {
      vi.useRealTimers();
    }
  });
});
