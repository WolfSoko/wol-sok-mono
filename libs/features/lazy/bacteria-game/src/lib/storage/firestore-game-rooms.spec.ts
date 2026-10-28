import { BehaviorSubject } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { FirestoreGameRooms, STUB_TTL_SECONDS } from './firestore-game-rooms';

class FakeTimestamp {
  public constructor(
    public readonly seconds: number,
    public readonly nanoseconds: number
  ) {}
  public static fromMillis(ms: number): FakeTimestamp {
    return new FakeTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
}

interface Snapshot {
  exists(): boolean;
  get(field: string): unknown;
}

/** Just enough of Firestore for one room: documents by path, live. */
class FakeFirestore {
  public readonly docs = new Map<string, Record<string, unknown>>();
  public readonly deleted: string[] = [];
  private readonly listeners = new Map<string, (snapshot: Snapshot) => void>();

  public readonly sdk = {
    Timestamp: FakeTimestamp,
    // The server's time, once stored.
    serverTimestamp: () => CREATED_AT,
    doc: (_db: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
    }),
    setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      this.docs.set(ref.path, data);
    },
    updateDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      this.docs.set(ref.path, { ...this.docs.get(ref.path), ...data });
      this.listeners.get(ref.path)?.(this.snapshot(ref.path));
    },
    deleteDoc: async (ref: { path: string }) => {
      this.deleted.push(ref.path);
      this.docs.delete(ref.path);
    },
    getDocFromServer: async (ref: { path: string }) => this.snapshot(ref.path),
    onSnapshot: (ref: { path: string }, next: (snapshot: Snapshot) => void) => {
      this.listeners.set(ref.path, next);
      return () => this.listeners.delete(ref.path);
    },
  };

  public rooms(uid: string): FirestoreGameRooms {
    return new FirestoreGameRooms(
      { db: {}, dbSdk: this.sdk } as unknown as FirebaseConnection,
      new BehaviorSubject<string | null>(uid)
    );
  }

  public snapshot(path: string): Snapshot {
    const data = this.docs.get(path);
    return { exists: () => data !== undefined, get: (field) => data?.[field] };
  }
}

/** When the fake server stored the room. */
const CREATED_AT = new FakeTimestamp(1_000, 123_456_789);

/** A room ada opened and bob answered. */
async function answered() {
  const fake = new FakeFirestore();
  const room = await fake.rooms('ada').open('offer');
  const joined = await fake.rooms('bob').join(room.code);
  await joined?.answer('answer');
  await expect(room.answer).resolves.toBe('answer');
  return { fake, room };
}

describe('FirestoreGameRooms', () => {
  it('swaps the answered room for its stub: who played, nothing of the descriptions', async () => {
    const { fake, room } = await answered();

    await room.take();

    // A whole new document, only what the rules' stub allows: the stored
    // creation time unchanged, the stub's life up to 6 hours from it.
    const stub = fake.docs.get(`rooms/${room.code}`);
    expect(stub).toEqual({
      host: 'ada',
      guest: 'bob',
      createdAt: CREATED_AT,
      expireAt: new FakeTimestamp(1_000 + STUB_TTL_SECONDS, 123_456_789),
      taken: true,
    });
    expect(stub?.['createdAt']).toBe(CREATED_AT);
    expect(fake.deleted).toEqual([]);
  });

  it('takes no room without a guest', async () => {
    const fake = new FakeFirestore();
    const room = await fake.rooms('ada').open('offer');

    await expect(room.take()).rejects.toThrow();
    expect(fake.docs.get(`rooms/${room.code}`)?.['taken']).toBeUndefined();
  });

  it('still deletes a room nobody joined', async () => {
    const fake = new FakeFirestore();
    const room = await fake.rooms('ada').open('offer');

    room.close();

    expect(fake.deleted).toEqual([`rooms/${room.code}`]);
  });
});
