import { BehaviorSubject, firstValueFrom, take, toArray } from 'rxjs';
import { replayOf } from '../state/replay';
import { replayFromBytes } from '../state/replay-pack';
import { onlineReplayId } from '../state/replay-id';
import type { MatchPlan } from '../state/match-setup';
import type { FirebaseConnection } from './firebase-connection';
import { COMMAND_TTL_MS, FirestoreGameReplays } from './firestore-game-replays';

const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'normal',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 180,
  seed: 7,
};
const LOCAL = replayOf(
  PLAN,
  'cpu',
  120,
  { steers: [[0, 0, 1, 0]], drags: [], boosts: [[30, 0]], weapons: [] },
  { outcome: { endedBy: 'time', winnerSeat: 0 }, checksum: 12345 }
);
const ONLINE = replayOf(
  { ...PLAN, mode: 'two-players' },
  'cpu',
  120,
  { steers: [], drags: [], boosts: [], weapons: [] },
  {
    outcome: { endedBy: 'annihilation', winnerSeat: 1 },
    checksum: 1,
    roomCode: 'K7QPXM',
    n: 2,
  }
);

class FakeBytes {
  public constructor(private readonly bytes: Uint8Array) {}
  public static fromUint8Array(bytes: Uint8Array): FakeBytes {
    return new FakeBytes(bytes);
  }
  public toUint8Array(): Uint8Array {
    return this.bytes;
  }
}

class FakeTimestamp {
  public constructor(public readonly ms: number) {}
  public static fromMillis(ms: number): FakeTimestamp {
    return new FakeTimestamp(ms);
  }
  public toMillis(): number {
    return this.ms;
  }
}

/** Just enough of Firestore for the replays: documents by path, one query. */
class FakeFirestore {
  public readonly docs = new Map<string, Record<string, unknown>>();
  public readonly queries: unknown[][] = [];
  /** Paths the rules refuse to read. */
  public readonly refused = new Set<string>();
  private ids = 0;

  public readonly sdk = {
    Bytes: FakeBytes,
    Timestamp: FakeTimestamp,
    serverTimestamp: () => 'now',
    collection: (_db: unknown, path: string) => ({ path }),
    doc: (parent: unknown, ...segments: string[]) => {
      if (segments.length === 0) {
        const path = `${(parent as { path: string }).path}/auto${++this.ids}`;
        return { path, id: `auto${this.ids}` };
      }
      const path = segments.join('/');
      return { path, id: segments[segments.length - 1] };
    },
    setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      this.docs.set(ref.path, data);
    },
    getDoc: async (ref: { path: string }) => this.snapshot(ref.path),
    onSnapshot: (
      ref: { path: string },
      next: (snapshot: unknown) => void,
      error: (error: unknown) => void
    ) => {
      if (this.refused.has(ref.path)) {
        error(
          Object.assign(new Error('refused'), { code: 'permission-denied' })
        );
      } else {
        next(this.snapshot(ref.path));
      }
      return () => undefined;
    },
    where: (...args: unknown[]) => ['where', ...args],
    orderBy: (...args: unknown[]) => ['orderBy', ...args],
    limit: (n: number) => ['limit', n],
    query: (collection: { path: string }, ...constraints: unknown[]) => {
      this.queries.push([collection.path, ...constraints]);
      return collection;
    },
    getDocs: async (collection: { path: string }) => ({
      docs: [...this.docs.entries()]
        .filter(([path]) => path.startsWith(`${collection.path}/`))
        .map(([path]) => this.snapshot(path)),
    }),
  };

  public replays(uid: string | null = 'ada'): FirestoreGameReplays {
    return new FirestoreGameReplays(
      { db: {}, dbSdk: this.sdk } as unknown as FirebaseConnection,
      new BehaviorSubject(uid)
    );
  }

  private snapshot(path: string) {
    const doc = this.docs.get(path);
    return {
      id: path.split('/').pop(),
      exists: () => doc !== undefined,
      get: (field: string) => doc?.[field],
      data: () => doc,
    };
  }
}

describe('FirestoreGameReplays', () => {
  let firestore: FakeFirestore;
  let replays: FirestoreGameReplays;

  beforeEach(() => {
    firestore = new FakeFirestore();
    replays = firestore.replays();
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes a submission with the fields the rules want, and a day to live', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000);

    const id = await replays.submit({ replay: LOCAL, hint: 61.6 });

    expect(id).toBe('l_auto1');
    const doc = firestore.docs.get('replaySubmissions/auto1');
    expect(doc).toEqual({
      uid: 'ada',
      bytes: expect.any(FakeBytes),
      hint: 62,
      createdAt: 'now',
      expireAt: new FakeTimestamp(1_000_000 + COMMAND_TTL_MS),
    });
    expect(COMMAND_TTL_MS).toBe(24 * 60 * 60 * 1000);
    const bytes = (doc as { bytes: FakeBytes }).bytes.toUint8Array();
    expect(
      await replayFromBytes(bytes as Uint8Array<ArrayBuffer>, { stored: true })
    ).toEqual(LOCAL);
  });

  it('names an online match by the id both devices work out, and carries an attempt', async () => {
    const id = await replays.submit({
      replay: ONLINE,
      hint: 200,
      attempt: 'att1',
    });

    expect(id).toBe(onlineReplayId('K7QPXM', 2, PLAN.seed));
    expect(firestore.docs.get('replaySubmissions/auto1')).toMatchObject({
      hint: 100,
      attempt: 'att1',
    });
  });

  it('says saved once the replay exists, and "not yet" while the rules refuse it', async () => {
    firestore.refused.add('replays/l_x');
    jest.useFakeTimers();
    try {
      const seen: boolean[] = [];
      const subscription = replays
        .watchSaved('l_x')
        .subscribe((saved) => seen.push(saved));
      expect(seen).toEqual([false]);

      firestore.refused.delete('replays/l_x');
      firestore.docs.set('replays/l_x', { players: ['ada'] });
      await jest.advanceTimersByTimeAsync(1000);

      expect(seen).toEqual([false, true]);
      subscription.unsubscribe();
    } finally {
      jest.useRealTimers();
    }
  });

  it("lists the player's replays with the query the rules allow", async () => {
    firestore.docs.set('replays/l_1', {
      players: ['ada'],
      kind: 'computer',
      levelId: 'petri-dish',
      balanceVersion: 3,
      replayVersion: 2,
      createdAt: new FakeTimestamp(500),
      ticks: 120,
      endedBy: 'time',
      winnerSeat: 0,
      hint: 40,
      state: 'submitted',
    });
    firestore.docs.set('replays/broken', { players: ['ada'], kind: 'what' });

    const listed = await replays.listMine(80);

    expect(firestore.queries).toEqual([
      [
        'replays',
        ['where', 'players', 'array-contains', 'ada'],
        ['orderBy', 'createdAt', 'desc'],
        ['limit', 50],
      ],
    ]);
    expect(listed).toEqual([
      {
        id: 'l_1',
        kind: 'computer',
        levelId: 'petri-dish',
        balanceVersion: 3,
        replayVersion: 2,
        createdAt: 500,
        ticks: 120,
        endedBy: 'time',
        winnerSeat: 0,
        hint: 40,
        state: 'submitted',
      },
    ]);
  });

  it("reads a replay's bytes from its blob, null for none", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    firestore.docs.set('replays/l_1/blob/data', {
      bytes: FakeBytes.fromUint8Array(bytes),
      size: 3,
    });

    expect(await replays.replayBytes('l_1')).toEqual(bytes);
    expect(await replays.replayBytes('l_2')).toBeNull();
  });

  it('sends a command and watches its result', async () => {
    const id = await replays.sendCommand('remove', 'l_1');

    expect(firestore.docs.get(`replayCommands/${id}`)).toEqual({
      uid: 'ada',
      type: 'remove',
      replayId: 'l_1',
      createdAt: 'now',
      expireAt: expect.any(FakeTimestamp),
    });
    expect(await firstValueFrom(replays.watchCommand(id as string))).toBeNull();

    firestore.docs.set(`replayCommands/${id}`, { result: { ok: true } });
    expect(
      await firstValueFrom(
        replays.watchCommand(id as string).pipe(take(1), toArray())
      )
    ).toEqual([{ ok: true }]);
  });
});
