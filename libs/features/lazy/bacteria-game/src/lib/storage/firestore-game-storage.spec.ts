import { BehaviorSubject, Subscription } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { FirestoreGameStorage } from './firestore-game-storage';

const KEY = 'bacteria-game.progress';

/**
 * Just enough of Firestore for the storage: documents by path, snapshot
 * listeners, transactions that fail while `offline` or `refused`.
 */
class FakeFirestore {
  public readonly docs = new Map<string, { json: string }>();
  public writes = 0;
  public offline = false;
  public refused = false;
  private readonly listeners = new Map<string, Set<() => void>>();

  public readonly sdk = {
    doc: (_db: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
    }),
    serverTimestamp: () => 'now',
    onSnapshot: (
      ref: { path: string },
      next: (snapshot: unknown) => void
    ): (() => void) => {
      const tell = () => next(this.snapshot(ref.path));
      const listeners = this.listeners.get(ref.path) ?? new Set();
      listeners.add(tell);
      this.listeners.set(ref.path, listeners);
      queueMicrotask(tell);
      return () => listeners.delete(tell);
    },
    setDoc: (ref: { path: string }, data: { json: string }) => {
      this.store(ref.path, data);
      return Promise.resolve();
    },
    runTransaction: async (
      _db: unknown,
      run: (transaction: unknown) => Promise<void>
    ) => {
      if (this.offline) {
        throw Object.assign(new Error('offline'), { code: 'unavailable' });
      }
      if (this.refused) {
        throw Object.assign(new Error('refused'), {
          code: 'permission-denied',
        });
      }
      const sets: [string, { json: string }][] = [];
      await run({
        get: async (ref: { path: string }) => this.snapshot(ref.path),
        set: (ref: { path: string }, data: { json: string }) =>
          sets.push([ref.path, data]),
      });
      sets.forEach(([path, data]) => this.store(path, data));
    },
  };

  public connection(): FirebaseConnection {
    return {
      db: {},
      dbSdk: this.sdk,
    } as unknown as FirebaseConnection;
  }

  public value(uid: string): unknown {
    const doc = this.docs.get(`players/${uid}/storage/${KEY}`);
    return doc === undefined ? null : JSON.parse(doc.json);
  }

  private snapshot(path: string) {
    const doc = this.docs.get(path);
    return { get: (field: 'json') => doc?.[field] };
  }

  private store(path: string, data: { json: string }): void {
    this.writes++;
    this.docs.set(path, { json: data.json });
    this.listeners.get(path)?.forEach((tell) => queueMicrotask(tell));
  }
}

/** Lets the promises and microtasks queued so far run. */
async function settle(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    await Promise.resolve();
  }
}

describe('FirestoreGameStorage', () => {
  let firestore: FakeFirestore;
  let players: BehaviorSubject<string | null>;
  let storage: FirestoreGameStorage;
  let subscription: Subscription | undefined;

  beforeEach(() => {
    firestore = new FakeFirestore();
    players = new BehaviorSubject<string | null>('alice');
    storage = new FirestoreGameStorage(firestore.connection(), players);
  });

  afterEach(() => {
    subscription?.unsubscribe();
    jest.useRealTimers();
  });

  function watched(): unknown[] {
    const values: unknown[] = [];
    subscription = storage.watch(KEY).subscribe((value) => values.push(value));
    return values;
  }

  const addOne = (stored: unknown) => ({
    count: ((stored as { count?: number } | null)?.count ?? 0) + 1,
  });

  it('reads nothing stored as null, then each value stored', async () => {
    const values = watched();
    await settle();

    storage.update(KEY, addOne);
    await settle();

    expect(values).toEqual([null, { count: 1 }]);
  });

  it('adds every change to the latest stored value, in turn', async () => {
    storage.update(KEY, addOne);
    storage.update(KEY, addOne);
    storage.update(KEY, addOne);
    await settle();

    expect(firestore.value('alice')).toEqual({ count: 3 });
  });

  it('skips a change that leaves the value as it is', async () => {
    storage.update(KEY, () => ({ count: 1 }));
    await settle();
    storage.update(KEY, () => ({ count: 1 }));
    await settle();

    expect(firestore.writes).toBe(1);
  });

  it('skips a write of the value last seen', async () => {
    watched();
    storage.write(KEY, { count: 1 });
    await settle();
    storage.write(KEY, { count: 1 });
    await settle();

    expect(firestore.writes).toBe(1);
  });

  it('applies a change made offline once online, exactly once', async () => {
    jest.useFakeTimers();
    firestore.offline = true;
    storage.update(KEY, addOne);
    await settle();
    expect(firestore.value('alice')).toBeNull();

    firestore.offline = false;
    await jest.advanceTimersByTimeAsync(1000);

    expect(firestore.value('alice')).toEqual({ count: 1 });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(firestore.writes).toBe(1);
  });

  it('drops a change the rules refuse', async () => {
    jest.useFakeTimers();
    firestore.refused = true;
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.update(KEY, addOne);
    await settle();

    firestore.refused = false;
    await jest.advanceTimersByTimeAsync(60_000);

    expect(firestore.writes).toBe(0);
  });

  it('answers for the next player after a switch', async () => {
    storage.update(KEY, () => ({ owner: 'alice' }));
    await settle();
    const values = watched();
    await settle();

    players.next('bob');
    storage.update(KEY, () => ({ owner: 'bob' }));
    await settle();

    expect(values).toEqual([{ owner: 'alice' }, null, { owner: 'bob' }]);
    expect(firestore.value('alice')).toEqual({ owner: 'alice' });
  });

  it('holds back what is stored while nobody plays, for the next guest', async () => {
    players.next(null);
    storage.update(KEY, addOne);
    await settle();
    expect(firestore.writes).toBe(0);

    players.next('guest');
    await settle();

    expect(firestore.value('guest')).toEqual({ count: 1 });
    expect(firestore.value('alice')).toBeNull();
  });

  it('holds the writes while a ban holds, and makes them once it ends', async () => {
    const banned = new BehaviorSubject(true);
    storage = new FirestoreGameStorage(firestore.connection(), players, banned);
    storage.update(KEY, addOne);
    storage.write('bacteria-game.settings', { sound: true });
    await settle();
    expect(firestore.writes).toBe(0);

    banned.next(false);
    await settle();

    expect(firestore.value('alice')).toEqual({ count: 1 });
    expect(firestore.writes).toBe(2);
  });
});
