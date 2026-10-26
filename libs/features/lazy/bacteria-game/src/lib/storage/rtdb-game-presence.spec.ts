import type { FirebaseConnection } from './firebase-connection';
import type { PresenceState } from './game-social';
import {
  REFUSED_RETRY_MS,
  REFUSED_TRIES,
  RtdbGamePresence,
} from './rtdb-game-presence';

/** Just enough of the Realtime Database for watching a status. */
class FakeRtdb {
  /** Paths the rules refuse to read. */
  public readonly refused = new Set<string>();
  /** Every listen, by path, in order. */
  public readonly listened: string[] = [];
  private readonly values = new Map<string, unknown>();
  private readonly emits = new Map<string, Set<() => void>>();

  public readonly rtdbSdk = {
    ref: (_db: unknown, path: string) => ({ path }),
    onValue: (
      ref: { path: string },
      next: (snapshot: unknown) => void,
      cancel?: (error: Error) => void
    ) => {
      this.listened.push(ref.path);
      if (ref.path === '.info/connected') {
        next({ val: () => false });
        return () => undefined;
      }
      if (this.refused.has(ref.path)) {
        // The database ends a refused listener for good.
        cancel?.(new Error('permission_denied'));
        return () => undefined;
      }
      const emit = () => {
        const value = this.values.get(ref.path) as
          | Record<string, unknown>
          | undefined;
        next({ child: (key: string) => ({ val: () => value?.[key] ?? null }) });
      };
      const set = this.emits.get(ref.path) ?? new Set<() => void>();
      set.add(emit);
      this.emits.set(ref.path, set);
      emit();
      return () => set.delete(emit);
    },
  };

  public set(path: string, value: unknown): void {
    this.values.set(path, value);
    this.emits.get(path)?.forEach((emit) => emit());
  }

  public presence(): RtdbGamePresence {
    return new RtdbGamePresence(
      { rtdbSdk: this.rtdbSdk } as unknown as FirebaseConnection,
      {} as NonNullable<FirebaseConnection['rtdb']>
    );
  }
}

describe('RtdbGamePresence', () => {
  let rtdb: FakeRtdb;

  beforeEach(() => {
    rtdb = new FakeRtdb();
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  function listensTo(path: string): number {
    return rtdb.listened.filter((each) => each === path).length;
  }

  it("reads a player's status", () => {
    const seen: (PresenceState | null)[] = [];
    rtdb
      .presence()
      .watch('bob')
      .subscribe((state) => seen.push(state));

    rtdb.set('status/bob', { state: 'playing', at: 1 });

    expect(seen).toEqual([null, 'playing']);
  });

  it('asks again while the rules refuse it, as until the friend mirror is written', () => {
    rtdb.refused.add('status/bob');
    const seen: (PresenceState | null)[] = [];
    rtdb
      .presence()
      .watch('bob')
      .subscribe((state) => seen.push(state));
    expect(seen).toEqual([null]);

    rtdb.refused.delete('status/bob');
    rtdb.set('status/bob', { state: 'online', at: 1 });
    jest.advanceTimersByTime(REFUSED_RETRY_MS);

    expect(seen).toEqual([null, 'online']);
    expect(listensTo('status/bob')).toBe(2);
  });

  it('gives up after a few refusals in a row', () => {
    rtdb.refused.add('status/bob');
    rtdb.presence().watch('bob').subscribe();

    jest.advanceTimersByTime(REFUSED_RETRY_MS * 100);

    expect(listensTo('status/bob')).toBe(REFUSED_TRIES + 1);
  });

  it('stops asking again once unsubscribed', () => {
    rtdb.refused.add('status/bob');
    rtdb.presence().watch('bob').subscribe().unsubscribe();

    jest.advanceTimersByTime(REFUSED_RETRY_MS * 100);

    expect(listensTo('status/bob')).toBe(1);
  });
});
