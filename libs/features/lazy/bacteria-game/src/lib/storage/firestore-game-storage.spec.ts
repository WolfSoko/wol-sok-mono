import { BehaviorSubject, Subscription } from 'rxjs';
import { FakeFirebase, settleSnapshots } from '../../testing/fake-firebase-sdk';
import { APPLIED_LIMIT, FirestoreGameStorage } from './firestore-game-storage';

const KEY = 'bacteria-game.progress';

const PATH_ALICE = `players/alice/storage/${KEY}`;

/** What is stored for the player under the key, parsed. */
function valueOf(firestore: FakeFirebase, uid: string): unknown {
  const doc = firestore.docs.get(`players/${uid}/storage/${KEY}`);
  return doc === undefined ? null : JSON.parse(doc['json'] as string);
}

describe('FirestoreGameStorage', () => {
  let firestore: FakeFirebase;
  let players: BehaviorSubject<string | null>;
  let storage: FirestoreGameStorage;
  let subscription: Subscription | undefined;

  beforeEach(() => {
    firestore = new FakeFirebase();
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
    await settleSnapshots();

    void storage.update(KEY, addOne);
    await settleSnapshots();

    expect(values).toEqual([null, { count: 1 }]);
  });

  it('adds every change to the latest stored value, in turn', async () => {
    void storage.update(KEY, addOne);
    void storage.update(KEY, addOne);
    void storage.update(KEY, addOne);
    await settleSnapshots();

    expect(valueOf(firestore, 'alice')).toEqual({ count: 3 });
  });

  it('skips a change that leaves the value as it is', async () => {
    void storage.update(KEY, () => ({ count: 1 }));
    await settleSnapshots();
    void storage.update(KEY, () => ({ count: 1 }));
    await settleSnapshots();

    expect(firestore.writes.length).toBe(1);
  });

  it('skips a write of the value last seen', async () => {
    watched();
    storage.write(KEY, { count: 1 });
    await settleSnapshots();
    storage.write(KEY, { count: 1 });
    await settleSnapshots();

    expect(firestore.writes.length).toBe(1);
  });

  it('applies a change made offline once online, exactly once', async () => {
    jest.useFakeTimers();
    firestore.offline = true;
    void storage.update(KEY, addOne);
    await settleSnapshots();
    expect(valueOf(firestore, 'alice')).toBeNull();

    firestore.offline = false;
    await jest.advanceTimersByTimeAsync(1000);

    expect(valueOf(firestore, 'alice')).toEqual({ count: 1 });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(firestore.writes.length).toBe(1);
  });

  it('drops a change the rules refuse', async () => {
    jest.useFakeTimers();
    firestore.refused.add(PATH_ALICE);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    void storage.update(KEY, addOne);
    await settleSnapshots();

    firestore.refused.delete(PATH_ALICE);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(firestore.writes.length).toBe(0);
  });

  it('says a change settled once its transaction committed', async () => {
    const settled = storage.update(KEY, addOne);
    await settleSnapshots();

    await expect(settled).resolves.toBe(true);
    expect(valueOf(firestore, 'alice')).toEqual({ count: 1 });
  });

  it('says a change that left the value as it is settled too', async () => {
    await expect(storage.update(KEY, () => null)).resolves.toBe(true);
  });

  it('says a change the rules refuse was dropped', async () => {
    firestore.refused.add(PATH_ALICE);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(storage.update(KEY, addOne)).resolves.toBe(false);
  });

  it('keeps a change made offline unsettled until it is stored', async () => {
    jest.useFakeTimers();
    firestore.offline = true;
    let settled: boolean | undefined;
    void storage.update(KEY, addOne).then((stored) => (settled = stored));
    await jest.advanceTimersByTimeAsync(5000);
    expect(settled).toBeUndefined();

    firestore.offline = false;
    await jest.advanceTimersByTimeAsync(60_000);

    expect(settled).toBe(true);
  });

  it('answers for the next player after a switch', async () => {
    void storage.update(KEY, () => ({ owner: 'alice' }));
    await settleSnapshots();
    const values = watched();
    await settleSnapshots();

    players.next('bob');
    void storage.update(KEY, () => ({ owner: 'bob' }));
    await settleSnapshots();

    expect(values).toEqual([{ owner: 'alice' }, null, { owner: 'bob' }]);
    expect(valueOf(firestore, 'alice')).toEqual({ owner: 'alice' });
  });

  it('holds back what is stored while nobody plays, for the next guest', async () => {
    players.next(null);
    void storage.update(KEY, addOne);
    await settleSnapshots();
    expect(firestore.writes.length).toBe(0);

    players.next('guest');
    await settleSnapshots();

    expect(valueOf(firestore, 'guest')).toEqual({ count: 1 });
    expect(valueOf(firestore, 'alice')).toBeNull();
  });

  describe('a change made once, by its id', () => {
    /** The ids of the changes made once that the document lists. */
    function appliedOf(uid = 'alice'): unknown {
      return firestore.docs.get(`players/${uid}/storage/${KEY}`)?.['applied'];
    }

    it('lands and lists its id', async () => {
      await storage.update(KEY, addOne, { once: 'adoption-1' });

      expect(valueOf(firestore, 'alice')).toEqual({ count: 1 });
      expect(appliedOf()).toEqual(['adoption-1']);
    });

    it('is skipped once its id is listed, however often it comes again', async () => {
      await storage.update(KEY, addOne, { once: 'adoption-1' });
      await expect(
        storage.update(KEY, addOne, { once: 'adoption-1' })
      ).resolves.toBe(true);
      await storage.update(KEY, addOne, { once: 'adoption-1' });

      expect(valueOf(firestore, 'alice')).toEqual({ count: 1 });
      expect(firestore.writes.length).toBe(1);
    });

    it('lands beside another change made once', async () => {
      await storage.update(KEY, addOne, { once: 'adoption-1' });
      await storage.update(KEY, addOne, { once: 'adoption-2' });

      expect(valueOf(firestore, 'alice')).toEqual({ count: 2 });
      expect(appliedOf()).toEqual(['adoption-1', 'adoption-2']);
    });

    it(`keeps only the last ${APPLIED_LIMIT} ids`, async () => {
      for (let i = 0; i <= APPLIED_LIMIT; i++) {
        await storage.update(KEY, addOne, { once: `adoption-${i}` });
      }

      const applied = appliedOf() as string[];
      expect(applied.length).toBe(APPLIED_LIMIT);
      expect(applied[0]).toBe('adoption-1');
      expect(applied.at(-1)).toBe(`adoption-${APPLIED_LIMIT}`);
    });

    it('stays listed after later changes and writes', async () => {
      await storage.update(KEY, addOne, { once: 'adoption-1' });
      await storage.update(KEY, addOne);
      watched();
      storage.write(KEY, { count: 9 });
      await settleSnapshots();

      expect(valueOf(firestore, 'alice')).toEqual({ count: 9 });
      expect(appliedOf()).toEqual(['adoption-1']);
      await storage.update(KEY, addOne, { once: 'adoption-1' });
      expect(valueOf(firestore, 'alice')).toEqual({ count: 9 });
    });

    it('is listed though it changed nothing, so a later value keeps it out', async () => {
      const once = { once: 'adoption-1' };
      const atMostOne = (stored: unknown) => ({
        count: Math.min(
          ((stored as { count?: number } | null)?.count ?? 0) + 1,
          1
        ),
      });
      await storage.update(KEY, () => ({ count: 1 }));
      await storage.update(KEY, atMostOne, once);
      await storage.update(KEY, () => ({ count: 0 }));
      await storage.update(KEY, atMostOne, once);

      expect(appliedOf()).toEqual(['adoption-1']);
      expect(valueOf(firestore, 'alice')).toEqual({ count: 0 });
    });

    it('lists nothing beside a value only ever changed plainly', async () => {
      await storage.update(KEY, addOne);
      storage.write('bacteria-game.settings', { sound: true });
      await settleSnapshots();

      expect(appliedOf()).toBeUndefined();
      expect(
        firestore.docs.get('players/alice/storage/bacteria-game.settings')?.[
          'applied'
        ]
      ).toBeUndefined();
    });
  });

  it('holds the writes while a ban holds, and makes them once it ends', async () => {
    const banned = new BehaviorSubject(true);
    storage = new FirestoreGameStorage(firestore.connection(), players, banned);
    void storage.update(KEY, addOne);
    storage.write('bacteria-game.settings', { sound: true });
    await settleSnapshots();
    expect(firestore.writes.length).toBe(0);

    banned.next(false);
    await settleSnapshots();

    expect(valueOf(firestore, 'alice')).toEqual({ count: 1 });
    expect(firestore.writes.length).toBe(2);
  });
});
