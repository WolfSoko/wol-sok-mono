import { BehaviorSubject } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { FirestoreGameModeration } from './firestore-game-moderation';
import type { PlayerBan, PlayerNotice } from './game-moderation';

const at = (ms: number) => ({ toMillis: () => ms });

/**
 * Just enough of Firestore and the Realtime Database for the player's ban
 * and notices: live documents and collections by path, values by path.
 */
class FakeBackend {
  private readonly docs = new Map<string, Record<string, unknown> | null>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly values = new Map<string, unknown>();
  private readonly valueListeners = new Map<string, Set<() => void>>();
  /** Every path listened to, in order. */
  public readonly listened: string[] = [];
  public readonly deleted: string[] = [];

  public readonly dbSdk = {
    doc: (_db: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
    }),
    collection: (_db: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
      collection: true,
    }),
    onSnapshot: (
      ref: { path: string; collection?: boolean },
      next: (snapshot: unknown) => void
    ) => {
      this.listened.push(ref.path);
      const emit = () =>
        next(
          ref.collection ? this.collectionOf(ref.path) : this.docOf(ref.path)
        );
      this.on(this.listeners, ref.path, emit);
      emit();
      return () => this.listeners.get(ref.path)?.delete(emit);
    },
    deleteDoc: async (ref: { path: string }) => {
      this.deleted.push(ref.path);
      this.set(ref.path, null);
    },
  };

  public readonly rtdbSdk = {
    ref: (_db: unknown, path: string) => ({ path }),
    onValue: (ref: { path: string }, next: (snapshot: unknown) => void) => {
      this.listened.push(`rtdb:${ref.path}`);
      const emit = () => next({ val: () => this.values.get(ref.path) ?? null });
      this.on(this.valueListeners, ref.path, emit);
      emit();
      return () => this.valueListeners.get(ref.path)?.delete(emit);
    },
  };

  public set(path: string, data: Record<string, unknown> | null): void {
    this.docs.set(path, data);
    for (const [listened, emits] of this.listeners) {
      if (path === listened || path.startsWith(`${listened}/`)) {
        emits.forEach((emit) => emit());
      }
    }
  }

  public setValue(path: string, value: unknown): void {
    this.values.set(path, value);
    this.valueListeners.get(path)?.forEach((emit) => emit());
  }

  public moderation(
    playerIds: BehaviorSubject<string | null>,
    rtdb = true
  ): FirestoreGameModeration {
    return new FirestoreGameModeration(
      {
        db: {},
        dbSdk: this.dbSdk,
        rtdb: rtdb ? {} : null,
        rtdbSdk: this.rtdbSdk,
      } as unknown as FirebaseConnection,
      playerIds
    );
  }

  private on(
    map: Map<string, Set<() => void>>,
    path: string,
    emit: () => void
  ): void {
    const set = map.get(path) ?? new Set();
    set.add(emit);
    map.set(path, set);
  }

  private docOf(path: string) {
    const data = this.docs.get(path) ?? null;
    return { exists: () => data !== null, data: () => data ?? undefined };
  }

  private collectionOf(path: string) {
    return {
      docs: [...this.docs.entries()]
        .filter(
          ([each, data]) =>
            data !== null &&
            each.startsWith(`${path}/`) &&
            !each.slice(path.length + 1).includes('/')
        )
        .map(([each, data]) => ({
          id: each.slice(path.length + 1),
          data: () => data,
        })),
    };
  }
}

describe('FirestoreGameModeration', () => {
  let backend: FakeBackend;
  let playerIds: BehaviorSubject<string | null>;

  beforeEach(() => {
    backend = new FakeBackend();
    playerIds = new BehaviorSubject<string | null>(null);
  });

  it('listens to nothing before a player signed in', () => {
    const bans: (PlayerBan | null)[] = [];
    backend
      .moderation(playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    expect(backend.listened).toEqual([]);
    expect(bans).toEqual([]);
  });

  it("reads the player's ban, with why and until when", () => {
    playerIds.next('ada');
    backend.set('bans/ada', { since: at(1), until: null, reason: 'spam' });
    const bans: (PlayerBan | null)[] = [];
    backend
      .moderation(playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    expect(bans).toEqual([{ since: 1, until: null, reason: 'spam' }]);
    backend.set('bans/ada', null);
    expect(bans.at(-1)).toBeNull();
  });

  it('takes the mirror for a ban while the stored one is not there yet', () => {
    playerIds.next('ada');
    const bans: (PlayerBan | null)[] = [];
    backend
      .moderation(playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    backend.setValue('bans/ada', 0);

    expect(backend.listened).toContain('rtdb:bans/ada');
    expect(bans.at(-1)).toEqual({ since: null, until: null, reason: null });
  });

  it('does without the mirror where there is no Realtime Database', () => {
    playerIds.next('ada');
    const bans: (PlayerBan | null)[] = [];
    backend
      .moderation(playerIds, false)
      .ban()
      .subscribe((ban) => bans.push(ban));

    expect(bans).toEqual([null]);
    expect(backend.listened).toEqual(['bans/ada']);
  });

  it('follows whoever plays', () => {
    playerIds.next('ada');
    backend.set('bans/bob', { since: at(1), until: null, reason: 'other' });
    const bans: (PlayerBan | null)[] = [];
    backend
      .moderation(playerIds)
      .ban()
      .subscribe((ban) => bans.push(ban));

    playerIds.next('bob');

    expect(bans).toEqual([null, { since: 1, until: null, reason: 'other' }]);
  });

  it('lists the notices oldest first, and deletes one dismissed', async () => {
    playerIds.next('ada');
    backend.set('players/ada/notices/b', { type: 'unbanned', at: at(20) });
    backend.set('players/ada/notices/a', {
      type: 'banned',
      at: at(10),
      until: at(15),
      reason: 'cheating',
    });
    const moderation = backend.moderation(playerIds);
    const seen: PlayerNotice[][] = [];
    moderation.notices().subscribe((notices) => seen.push(notices));

    expect(seen.at(-1)?.map((notice) => notice.id)).toEqual(['a', 'b']);
    await moderation.dismiss('a');

    expect(backend.deleted).toEqual(['players/ada/notices/a']);
    expect(seen.at(-1)?.map((notice) => notice.id)).toEqual(['b']);
  });
});
