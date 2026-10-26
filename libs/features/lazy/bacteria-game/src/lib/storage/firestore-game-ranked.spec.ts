import { BehaviorSubject } from 'rxjs';
import { ATTEMPT_DAYS } from '../state/attempts';
import type { FirebaseConnection } from './firebase-connection';
import { FirestoreGameRanked } from './firestore-game-ranked';
import { DECLARE_TIMEOUT_MS } from './game-ranked';

class FakeTimestamp {
  public constructor(public readonly ms: number) {}
  public static fromMillis(ms: number): FakeTimestamp {
    return new FakeTimestamp(ms);
  }
  public toMillis(): number {
    return this.ms;
  }
}

const SERVER_TIME = Date.UTC(2026, 9, 26, 12);

/**
 * Just enough of Firestore for the declarations: documents by path, a
 * transaction that reads and writes them, the server's time on write.
 */
class FakeFirestore {
  public readonly docs = new Map<string, Record<string, unknown>>();
  /** What each transaction wrote, in order. */
  public readonly writes: [string, Record<string, unknown>][] = [];
  public failing = false;
  /** Set to make a transaction never answer. */
  public hanging = false;

  public readonly sdk = {
    Timestamp: FakeTimestamp,
    serverTimestamp: () => 'server-time',
    doc: (_db: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
      id: segments[segments.length - 1],
    }),
    getDoc: async (ref: { path: string; id: string }) => this.snapshot(ref),
    getDocFromServer: async (ref: { path: string; id: string }) =>
      this.snapshot(ref),
    runTransaction: async (
      _db: unknown,
      update: (transaction: unknown) => Promise<void>
    ) => {
      if (this.hanging) {
        return new Promise<void>(() => undefined);
      }
      if (this.failing) {
        throw Object.assign(new Error('offline'), { code: 'unavailable' });
      }
      const staged: [string, Record<string, unknown>][] = [];
      await update({
        get: async (ref: { path: string; id: string }) => this.snapshot(ref),
        set: (ref: { path: string }, data: Record<string, unknown>) =>
          staged.push([ref.path, data]),
      });
      for (const [path, data] of staged) {
        this.writes.push([path, data]);
        // The server fills in its time.
        this.docs.set(path, {
          ...data,
          at:
            data['at'] === 'server-time'
              ? new FakeTimestamp(SERVER_TIME)
              : data['at'],
        });
      }
    },
  };

  public ranked(uid: string | null = 'ada'): FirestoreGameRanked {
    return new FirestoreGameRanked(
      { db: {}, dbSdk: this.sdk } as unknown as FirebaseConnection,
      new BehaviorSubject(uid)
    );
  }

  private snapshot(ref: { path: string; id: string }) {
    const data = this.docs.get(ref.path);
    return {
      id: ref.id,
      exists: () => data !== undefined,
      get: (field: string) => data?.[field],
    };
  }
}

describe('FirestoreGameRanked', () => {
  let firestore: FakeFirestore;

  beforeEach(() => {
    firestore = new FakeFirestore();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('declares with the server time and an end 31 days ahead - nothing else', async () => {
    const declared = await firestore.ranked().declare('d_2026-10-26_1');

    expect(declared).toEqual({ uid: 'ada', at: SERVER_TIME });
    const [[path, data]] = firestore.writes;
    expect(path).toBe('players/ada/attempts/d_2026-10-26_1');
    expect(Object.keys(data).sort()).toEqual(['at', 'expireAt']);
    expect(data['at']).toBe('server-time');
    const days =
      ((data['expireAt'] as FakeTimestamp).ms - Date.now()) / 86_400_000;
    expect(days).toBeCloseTo(ATTEMPT_DAYS, 2);
  });

  it('refuses an attempt declared already', async () => {
    firestore.docs.set('players/ada/attempts/d_2026-10-26_1', {
      at: new FakeTimestamp(1),
    });

    expect(await firestore.ranked().declare('d_2026-10-26_1')).toBe('taken');
    expect(firestore.writes).toEqual([]);
  });

  it('declares a void daily attempt again, whole, without its void marks', async () => {
    firestore.docs.set('players/ada/attempts/d_2026-10-26_2', {
      at: new FakeTimestamp(1),
      void: true,
      voidReason: 'cap',
    });

    expect(await firestore.ranked().declare('d_2026-10-26_2')).toEqual({
      uid: 'ada',
      at: SERVER_TIME,
    });
    expect(Object.keys(firestore.writes[0][1]).sort()).toEqual([
      'at',
      'expireAt',
    ]);
  });

  it('never declares a void endless match again: it counts as not played', async () => {
    firestore.docs.set('players/ada/attempts/e_202610261_3', {
      at: new FakeTimestamp(1),
      void: true,
    });

    expect(await firestore.ranked().declare('e_202610261_3')).toBe('taken');
  });

  it('fails when the transaction does - offline it is not queued', async () => {
    firestore.failing = true;

    expect(await firestore.ranked().declare('d_2026-10-26_1')).toBe('failed');
  });

  it('gives up after the timeout', async () => {
    jest.useFakeTimers();
    firestore.hanging = true;
    const declared = firestore.ranked().declare('d_2026-10-26_1');
    await jest.advanceTimersByTimeAsync(DECLARE_TIMEOUT_MS);

    expect(await declared).toBe('failed');
    jest.useRealTimers();
  });

  it('reads back which of the ids are declared, and which are void', async () => {
    firestore.docs.set('players/ada/attempts/d_2026-10-26_1', {
      at: new FakeTimestamp(5),
    });
    firestore.docs.set('players/ada/attempts/d_2026-10-26_2', {
      at: new FakeTimestamp(6),
      void: true,
    });

    expect(
      await firestore
        .ranked()
        .declared(['d_2026-10-26_1', 'd_2026-10-26_2', 'd_2026-10-26_3'])
    ).toEqual([
      { id: 'd_2026-10-26_1', at: 5, void: false },
      { id: 'd_2026-10-26_2', at: 6, void: true },
    ]);
  });
});
