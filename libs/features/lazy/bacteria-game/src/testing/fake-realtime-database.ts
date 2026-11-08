import { later, sdkError } from './fake-callbacks';

/** What `serverTimestamp()` hands the adapter: the field before the write. */
export const RTDB_SERVER_TIMESTAMP = Object.freeze({ '.sv': 'timestamp' });

/** The error code the database refuses a read or a write with. */
export const RTDB_PERMISSION_DENIED = 'PERMISSION_DENIED';

/** A write the fake applied, with the value as the adapter sent it. */
export interface FakeValueWrite {
  kind: 'set' | 'remove' | 'onDisconnect.remove' | 'onDisconnect.cancel';
  path: string;
  value?: unknown;
}

/** What the fake shares with the rest of `FakeFirebase`. */
export interface FakeRealtimeDatabaseOptions {
  /** The log of listens, each as `rtdb:<path>`. */
  listened?: string[];
  /** Paths the rules refuse, each as `rtdb:<path>`. */
  refused?: Set<string>;
  /** The server's time in ms, stored for `serverTimestamp()`. */
  serverTime?: () => number;
}

interface ValueRef {
  path: string;
}

interface ValueSnapshot {
  val(): unknown;
  child(key: string): { val(): unknown };
}

/**
 * The Realtime Database calls the game's adapters use on `rtdbSdk`, in
 * memory: values by their exact path (no tree: a listener on a parent is
 * not told of a child's write), listeners the rules may refuse, writes,
 * and `onDisconnect` with {@link disconnect} as a dropped connection.
 * `.info/connected` is an ordinary value a spec sets.
 */
export class FakeRealtimeDatabase {
  /** The stored values by path; a spec seeds them with {@link put}. */
  public readonly values = new Map<string, unknown>();
  /** Every write applied, in order. */
  public readonly writes: FakeValueWrite[] = [];
  /** Every listen, in order, as `rtdb:<path>`. */
  public readonly listened: string[];
  /** Paths the rules refuse to read or write, as `rtdb:<path>`. */
  public readonly refused: Set<string>;

  private readonly serverTime: () => number;
  private readonly listeners = new Map<string, Set<() => void>>();
  /** Paths whose removal the server holds for a dropped connection. */
  private readonly armed = new Set<string>();

  public constructor(options: FakeRealtimeDatabaseOptions = {}) {
    this.listened = options.listened ?? [];
    this.refused = options.refused ?? new Set();
    this.serverTime = options.serverTime ?? (() => 0);
  }

  /** The SDK's Realtime Database calls. */
  public readonly sdk = {
    ref: (_db: unknown, path: string): ValueRef => ({ path }),
    serverTimestamp: () => RTDB_SERVER_TIMESTAMP,
    onValue: (
      ref: ValueRef,
      next: (snapshot: ValueSnapshot) => void,
      cancel?: (error: Error) => void
    ): (() => void) => this.listen(ref.path, next, cancel),
    set: async (ref: ValueRef, value: unknown): Promise<void> => {
      this.check(ref.path);
      this.writes.push({ kind: 'set', path: ref.path, value });
      this.put(ref.path, this.stamped(value));
    },
    remove: async (ref: ValueRef): Promise<void> => {
      this.check(ref.path);
      this.writes.push({ kind: 'remove', path: ref.path });
      this.put(ref.path, null);
    },
    onDisconnect: (ref: ValueRef) => ({
      remove: async (): Promise<void> => {
        this.check(ref.path);
        this.writes.push({ kind: 'onDisconnect.remove', path: ref.path });
        this.armed.add(ref.path);
      },
      cancel: async (): Promise<void> => {
        this.check(ref.path);
        this.writes.push({ kind: 'onDisconnect.cancel', path: ref.path });
        this.armed.delete(ref.path);
      },
    }),
  };

  /**
   * Stores a value - or removes it, for null - and tells its listeners, as
   * another device's write would: not in `writes`.
   */
  public put(path: string, value: unknown): void {
    if (value === null) {
      this.values.delete(path);
    } else {
      this.values.set(path, value);
    }
    this.listeners.get(path)?.forEach((emit) => emit());
  }

  /**
   * The connection drops: the server applies the armed removals and the
   * device sees `.info/connected` false.
   */
  public disconnect(): void {
    const armed = [...this.armed];
    this.armed.clear();
    armed.forEach((path) => this.put(path, null));
    this.put('.info/connected', false);
  }

  /** Whether the server holds a removal of the path for a disconnect. */
  public armedFor(path: string): boolean {
    return this.armed.has(path);
  }

  private listen(
    path: string,
    next: (snapshot: ValueSnapshot) => void,
    cancel?: (error: Error) => void
  ): () => void {
    this.listened.push(`rtdb:${path}`);
    const emits = this.listeners.get(path) ?? new Set<() => void>();
    this.listeners.set(path, emits);
    let stopped = false;
    const stop = (): void => {
      stopped = true;
      emits.delete(emit);
    };
    const tellNow = (): void => {
      if (stopped) {
        return;
      }
      if (this.refused.has(`rtdb:${path}`)) {
        // The database ends a refused listener for good.
        stop();
        cancel?.(sdkError(RTDB_PERMISSION_DENIED));
        return;
      }
      next(this.snapshot(path));
    };
    const emit = (): void => later(tellNow);
    emits.add(emit);
    emit();
    return stop;
  }

  private snapshot(path: string): ValueSnapshot {
    const value = this.values.get(path) ?? null;
    return {
      val: () => value,
      child: (key) => ({
        val: () =>
          typeof value === 'object' && value !== null
            ? ((value as Record<string, unknown>)[key] ?? null)
            : null,
      }),
    };
  }

  private check(path: string): void {
    if (this.refused.has(`rtdb:${path}`)) {
      throw sdkError(RTDB_PERMISSION_DENIED);
    }
  }

  /** The value as stored: the server's time in place of the sentinel. */
  private stamped(value: unknown): unknown {
    if (value === RTDB_SERVER_TIMESTAMP) {
      return this.serverTime();
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, field]) => [key, this.stamped(field)])
    );
  }
}
