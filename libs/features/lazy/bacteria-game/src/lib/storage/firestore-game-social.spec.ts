import { firstValueFrom } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { FirestoreGameSocial, inviteToken } from './firestore-game-social';
import type { QueueEntry } from './game-social';

describe('inviteToken', () => {
  it('is twenty letters and digits, a letter per byte', () => {
    expect(inviteToken()).toMatch(/^[a-z2-9]{20}$/);
    expect(inviteToken(new Uint8Array(20))).toBe('a'.repeat(20));
    expect(inviteToken(new Uint8Array(20).fill(255))).toBe('9'.repeat(20));
  });
});

/** Just enough of Firestore for the queue: documents by path. */
class FakeFirestore {
  public readonly docs = new Map<string, Record<string, unknown>>();
  public readonly updates: [string, Record<string, unknown>][] = [];

  public readonly sdk = {
    doc: (_db: unknown, path: string) => ({ path }),
    serverTimestamp: () => 'now',
    Timestamp: class {
      public static fromMillis(ms: number) {
        return { ms };
      }
    },
    deleteDoc: async (ref: { path: string }) => {
      this.docs.delete(ref.path);
    },
    setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
      this.docs.set(ref.path, data);
    },
    updateDoc: async (ref: { path: string }, data: Record<string, unknown>) =>
      this.update(ref.path, data),
    onSnapshot: (
      ref: { path: string },
      next: (snapshot: unknown) => void
    ): (() => void) => {
      next(this.snapshot(ref.path));
      return () => undefined;
    },
    runTransaction: async <T>(
      _db: unknown,
      run: (transaction: unknown) => Promise<T>
    ): Promise<T> =>
      run({
        get: async (ref: { path: string }) => this.snapshot(ref.path),
        update: (ref: { path: string }, data: Record<string, unknown>) =>
          this.update(ref.path, data),
      }),
  };

  public social(): FirestoreGameSocial {
    return new FirestoreGameSocial({
      db: {},
      dbSdk: this.sdk,
    } as unknown as FirebaseConnection);
  }

  private update(path: string, data: Record<string, unknown>): void {
    this.updates.push([path, data]);
    this.docs.set(path, { ...this.docs.get(path), ...data });
  }

  private snapshot(path: string) {
    const doc = this.docs.get(path);
    return {
      exists: () => doc !== undefined,
      get: (field: string) => doc?.[field],
    };
  }
}

describe('FirestoreGameSocial queue', () => {
  let firestore: FakeFirestore;
  let social: FirestoreGameSocial;

  beforeEach(() => {
    firestore = new FakeFirestore();
    social = firestore.social();
  });

  async function entry(uid: string): Promise<QueueEntry | null> {
    return firstValueFrom(social.watchQueueEntry(uid));
  }

  it('puts the level the player would like into the entry', async () => {
    await social.enqueue('ada', 'hourglass');
    expect(firestore.docs.get('queue/ada')).toMatchObject({
      level: 'hourglass',
      claim: null,
    });

    await social.enqueue('bob', null);
    expect(firestore.docs.get('queue/bob')).toMatchObject({ level: null });
    // What the rules refuse goes in as any level.
    await social.enqueue('cid', 'Not A Level!');
    expect(firestore.docs.get('queue/cid')).toMatchObject({ level: null });
  });

  it('changes the level with `seen` and `expireAt`, as the rules want it', async () => {
    await social.enqueue('ada', null);

    await social.setQueueLevel('ada', 'corridors');

    expect(firestore.updates).toEqual([
      [
        'queue/ada',
        { level: 'corridors', seen: 'now', expireAt: expect.anything() },
      ],
    ]);
  });

  it('picks from the level in the entry at the claim, and writes the pick', async () => {
    await social.enqueue('ada', 'hourglass');
    const pick = jest.fn((level: string | null) => ({
      levelId: level ?? 'petri-dish',
      pick: 'waiting' as const,
    }));

    const picked = await social.claim('ada', 'bob', 'ROOM22', pick);

    expect(pick).toHaveBeenCalledWith('hourglass');
    expect(picked).toEqual({ levelId: 'hourglass', pick: 'waiting' });
    expect(firestore.docs.get('queue/ada')?.['claim']).toEqual({
      by: 'bob',
      code: 'ROOM22',
      level: 'hourglass',
      pick: 'waiting',
    });
    expect(await entry('ada')).toMatchObject({
      level: 'hourglass',
      claim: 'ROOM22',
      picked: { levelId: 'hourglass', pick: 'waiting' },
    });
    // Taken: nobody else gets them.
    expect(await social.claim('ada', 'cid', 'ROOM33', pick)).toBeNull();
  });

  it('reads a claim from an older build, which names no level', async () => {
    firestore.docs.set('queue/ada', {
      claim: { by: 'bob', code: 'ROOM22' },
    });

    expect(await entry('ada')).toMatchObject({
      level: null,
      claim: 'ROOM22',
      picked: null,
    });
  });
});
