import { BehaviorSubject } from 'rxjs';
import { ATTEMPT_DAYS, attemptSeed } from '@wolsok/feat-shared-bacteria-engine';
import {
  FakeFirebase,
  FakeTimestamp,
  SERVER_TIMESTAMP,
} from '../../testing/fake-firebase-sdk';
import { FirestoreGameRanked } from './firestore-game-ranked';
import { DECLARE_TIMEOUT_MS, LOAD_TIMEOUT_MS } from './game-ranked';

const SERVER_TIME = Date.UTC(2026, 9, 26, 12);

const stamp = (ms: number) => FakeTimestamp.fromMillis(ms);

/** The ranked backend of whoever plays, on the fake. */
function rankedOf(
  firestore: FakeFirebase,
  uid: string | null = 'ada'
): FirestoreGameRanked {
  return new FirestoreGameRanked(
    firestore.connection(),
    new BehaviorSubject(uid)
  );
}

/** What each transaction wrote, in order, as the adapter sent it. */
function writesOf(
  firestore: FakeFirebase
): [string, Record<string, unknown>][] {
  return firestore.writes.map((write) => [write.path, write.data ?? {}]);
}

describe('FirestoreGameRanked', () => {
  let firestore: FakeFirebase;

  beforeEach(() => {
    firestore = new FakeFirebase({ serverTime: SERVER_TIME });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('declares with the server time and an end 31 days ahead - nothing else', async () => {
    const declared = await rankedOf(firestore).declare('d_2026-10-26_1');

    expect(declared).toEqual({ uid: 'ada', at: SERVER_TIME });
    const [[path, data]] = writesOf(firestore);
    expect(path).toBe('players/ada/attempts/d_2026-10-26_1');
    expect(Object.keys(data).sort()).toEqual(['at', 'expireAt']);
    expect(data['at']).toBe(SERVER_TIMESTAMP);
    const days =
      ((data['expireAt'] as FakeTimestamp).toMillis() - Date.now()) /
      86_400_000;
    expect(days).toBeCloseTo(ATTEMPT_DAYS, 2);
  });

  it('refuses an attempt declared already', async () => {
    firestore.docs.set('players/ada/attempts/d_2026-10-26_1', {
      at: stamp(1),
    });

    expect(await rankedOf(firestore).declare('d_2026-10-26_1')).toBe('taken');
    expect(firestore.writes).toEqual([]);
  });

  it('declares a void daily attempt again, whole, without its void marks', async () => {
    firestore.docs.set('players/ada/attempts/d_2026-10-26_2', {
      at: stamp(1),
      void: true,
      voidReason: 'cap',
    });

    expect(await rankedOf(firestore).declare('d_2026-10-26_2')).toEqual({
      uid: 'ada',
      at: SERVER_TIME,
    });
    expect(Object.keys(writesOf(firestore)[0][1]).sort()).toEqual([
      'at',
      'expireAt',
    ]);
  });

  it('never declares a void endless match again: it counts as not played', async () => {
    firestore.docs.set('players/ada/attempts/e_202610261_3', {
      at: stamp(1),
      void: true,
    });

    expect(await rankedOf(firestore).declare('e_202610261_3')).toBe('taken');
  });

  it('fails when the transaction does - offline it is not queued', async () => {
    firestore.offline = true;

    expect(await rankedOf(firestore).declare('d_2026-10-26_1')).toBe('failed');
  });

  it('gives up after the timeout', async () => {
    jest.useFakeTimers();
    firestore.hanging = true;
    const declared = rankedOf(firestore).declare('d_2026-10-26_1');
    await jest.advanceTimersByTimeAsync(DECLARE_TIMEOUT_MS);

    expect(await declared).toBe('failed');
    jest.useRealTimers();
  });

  it('reads the server time back in whole milliseconds, as the server does', async () => {
    // 123456000 ns past the second: the browser's `toMillis()` says .456.
    firestore.serverTime = SERVER_TIME + 123.456;

    const declared = await rankedOf(firestore).declare('d_2026-10-26_1');

    expect(declared).toEqual({ uid: 'ada', at: SERVER_TIME + 123 });
    const at = typeof declared === 'string' ? NaN : declared.at;
    expect(Number.isInteger(at)).toBe(true);
    expect(attemptSeed('ada', 'd_2026-10-26_1', at)).toBe(
      attemptSeed('ada', 'd_2026-10-26_1', SERVER_TIME + 123)
    );
    firestore.docs.set('players/ada/attempts/d_2026-10-26_2', {
      at: stamp(SERVER_TIME + 0.5),
    });
    expect(
      await rankedOf(firestore).declared(['d_2026-10-26_1', 'd_2026-10-26_2'])
    ).toEqual([
      { id: 'd_2026-10-26_1', at: SERVER_TIME + 123, void: false },
      { id: 'd_2026-10-26_2', at: SERVER_TIME, void: false },
    ]);
  });

  it('takes a declaration that committed just past the deadline, read once more from the server', async () => {
    jest.useFakeTimers();
    firestore.lateCommit = true;
    const declared = rankedOf(firestore).declare('d_2026-10-26_1');
    await jest.advanceTimersByTimeAsync(DECLARE_TIMEOUT_MS);

    expect(await declared).toEqual({ uid: 'ada', at: SERVER_TIME });
    jest.useRealTimers();
  });

  it('fails past the deadline when the server holds the attempt still void', async () => {
    jest.useFakeTimers();
    firestore.hanging = true;
    firestore.docs.set('players/ada/attempts/d_2026-10-26_1', {
      at: stamp(1),
      void: true,
    });
    const declared = rankedOf(firestore).declare('d_2026-10-26_1');
    await jest.advanceTimersByTimeAsync(DECLARE_TIMEOUT_MS);

    expect(await declared).toBe('failed');
    jest.useRealTimers();
  });

  it('gives up reading the declared attempts after a while: unknown, not none', async () => {
    jest.useFakeTimers();
    firestore.hangingReads = true;
    const declared = rankedOf(firestore).declared(['d_2026-10-26_1']);
    await jest.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS);

    expect(await declared).toBeNull();
    jest.useRealTimers();
  });

  it('reads back which of the ids are declared, and which are void', async () => {
    firestore.docs.set('players/ada/attempts/d_2026-10-26_1', {
      at: stamp(5),
    });
    firestore.docs.set('players/ada/attempts/d_2026-10-26_2', {
      at: stamp(6),
      void: true,
    });

    expect(
      await rankedOf(firestore).declared([
        'd_2026-10-26_1',
        'd_2026-10-26_2',
        'd_2026-10-26_3',
      ])
    ).toEqual([
      { id: 'd_2026-10-26_1', at: 5, void: false },
      { id: 'd_2026-10-26_2', at: 6, void: true },
    ]);
  });
});
