import { BehaviorSubject, Subscription } from 'rxjs';
import { FakeFirebase, settleSnapshots } from '../../testing/fake-firebase-sdk';
import { FirestoreGameStorage } from './firestore-game-storage';

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

    storage.update(KEY, addOne);
    await settleSnapshots();

    expect(values).toEqual([null, { count: 1 }]);
  });

  it('adds every change to the latest stored value, in turn', async () => {
    storage.update(KEY, addOne);
    storage.update(KEY, addOne);
    storage.update(KEY, addOne);
    await settleSnapshots();

    expect(valueOf(firestore, 'alice')).toEqual({ count: 3 });
  });

  it('skips a change that leaves the value as it is', async () => {
    storage.update(KEY, () => ({ count: 1 }));
    await settleSnapshots();
    storage.update(KEY, () => ({ count: 1 }));
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
    storage.update(KEY, addOne);
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
    storage.update(KEY, addOne);
    await settleSnapshots();

    firestore.refused.delete(PATH_ALICE);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(firestore.writes.length).toBe(0);
  });

  it('answers for the next player after a switch', async () => {
    storage.update(KEY, () => ({ owner: 'alice' }));
    await settleSnapshots();
    const values = watched();
    await settleSnapshots();

    players.next('bob');
    storage.update(KEY, () => ({ owner: 'bob' }));
    await settleSnapshots();

    expect(values).toEqual([{ owner: 'alice' }, null, { owner: 'bob' }]);
    expect(valueOf(firestore, 'alice')).toEqual({ owner: 'alice' });
  });

  it('holds back what is stored while nobody plays, for the next guest', async () => {
    players.next(null);
    storage.update(KEY, addOne);
    await settleSnapshots();
    expect(firestore.writes.length).toBe(0);

    players.next('guest');
    await settleSnapshots();

    expect(valueOf(firestore, 'guest')).toEqual({ count: 1 });
    expect(valueOf(firestore, 'alice')).toBeNull();
  });

  it('holds the writes while a ban holds, and makes them once it ends', async () => {
    const banned = new BehaviorSubject(true);
    storage = new FirestoreGameStorage(firestore.connection(), players, banned);
    storage.update(KEY, addOne);
    storage.write('bacteria-game.settings', { sound: true });
    await settleSnapshots();
    expect(firestore.writes.length).toBe(0);

    banned.next(false);
    await settleSnapshots();

    expect(valueOf(firestore, 'alice')).toEqual({ count: 1 });
    expect(firestore.writes.length).toBe(2);
  });
});
