import type { FirebaseConnection } from '../lib/storage/firebase-connection';

/** A document's fields, as the fake stores them. */
export type FakeDoc = Record<string, unknown>;

/** A write the fake applied, with the data as the adapter sent it. */
export interface FakeWrite {
  kind: 'set' | 'update' | 'delete';
  path: string;
  data?: FakeDoc;
}

/** What a spec starts the fake with. */
export interface FakeFirebaseOptions {
  /** Documents by path, stored as they are (no server time filled in). */
  docs?: Record<string, FakeDoc>;
  /** Paths the rules refuse to read or write. */
  refused?: Iterable<string>;
  /** The server's time in ms, which `serverTimestamp()` stores. */
  serverTime?: number;
}

/** The server's time when nothing else is set: 2026-10-26 12:00 UTC. */
export const FAKE_SERVER_TIME = Date.UTC(2026, 9, 26, 12);

/** What `serverTimestamp()` hands the adapter: the field before the write. */
export const SERVER_TIMESTAMP = Object.freeze({ serverTimestamp: true });

/** A timestamp as the browser SDK has it: `toMillis()` keeps a fraction. */
export class FakeTimestamp {
  public constructor(
    public readonly seconds: number,
    public readonly nanoseconds: number
  ) {}

  public static fromMillis(ms: number): FakeTimestamp {
    const seconds = Math.floor(ms / 1000);
    return new FakeTimestamp(seconds, Math.round((ms - seconds * 1000) * 1e6));
  }

  public toMillis(): number {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }
}

/** Bytes as the SDK wraps them. */
export class FakeBytes {
  public constructor(private readonly bytes: Uint8Array) {}

  public static fromUint8Array(bytes: Uint8Array): FakeBytes {
    return new FakeBytes(bytes);
  }

  public toUint8Array(): Uint8Array {
    return this.bytes;
  }
}

interface DocRef {
  path: string;
  id: string;
  kind: 'doc';
}

interface CollectionRef {
  path: string;
  id: string;
  kind: 'collection';
}

type Constraint =
  | { type: 'where'; field: string; op: string; value: unknown }
  | { type: 'orderBy'; field: string; direction: 'asc' | 'desc' }
  | { type: 'limit'; count: number };

interface QueryRef {
  path: string;
  kind: 'query';
  constraints: Constraint[];
}

type Listened = DocRef | CollectionRef | QueryRef;

interface DocSnapshot {
  id: string;
  ref: DocRef;
  exists(): boolean;
  data(): FakeDoc | undefined;
  get(field: string): unknown;
  metadata: { fromCache: boolean };
}

interface QuerySnapshot {
  docs: DocSnapshot[];
  empty: boolean;
  size: number;
  metadata: { fromCache: boolean };
}

interface Listener {
  ref: Listened;
  emit(): void;
}

/** A write staged by a transaction or a batch. */
type Staged = () => void;

/** An error with the code the SDK gives it. */
function firestoreError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

/** A promise that never settles: a call whose answer never arrives. */
function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

/** Orders two field values, timestamps by their time. */
function compare(a: unknown, b: unknown): number {
  const left = a instanceof FakeTimestamp ? a.toMillis() : a;
  const right = b instanceof FakeTimestamp ? b.toMillis() : b;
  if (left === right) {
    return 0;
  }
  return (left as number | string) < (right as number | string) ? -1 : 1;
}

const OPERATORS: Record<string, (field: unknown, value: unknown) => boolean> = {
  '==': (field, value) => compare(field, value) === 0,
  '<': (field, value) => field !== undefined && compare(field, value) < 0,
  '<=': (field, value) => field !== undefined && compare(field, value) <= 0,
  '>': (field, value) => field !== undefined && compare(field, value) > 0,
  '>=': (field, value) => field !== undefined && compare(field, value) >= 0,
  'array-contains': (field, value) =>
    Array.isArray(field) && field.includes(value),
};

/**
 * The Firebase SDK surface the game's adapters call on `FirebaseConnection`
 * (`dbSdk`, `rtdbSdk`), in memory, for their specs: documents by path,
 * auto ids, the server's time on write, queries, live listeners, batches
 * and transactions, with switches for what the network and the rules do.
 * The rules emulator suite stays the check of the rules themselves.
 */
export class FakeFirebase {
  /** The stored documents by path; a spec may seed them silently. */
  public readonly docs = new Map<string, FakeDoc>();
  /** Every write applied, in order. */
  public readonly writes: FakeWrite[] = [];
  /** Every query read or listened to, as `[path, ...constraints]`. */
  public readonly queries: unknown[][] = [];
  /** Every path listened to, in order; the Realtime Database's as `rtdb:<path>`. */
  public readonly listened: string[] = [];
  /** Paths the rules refuse to read or write: `permission-denied`. */
  public readonly refused: Set<string>;
  /** Paths whose first snapshot waits for a write, as from the server. */
  public readonly pending = new Set<string>();
  /** The server's time in ms, stored for `serverTimestamp()`. */
  public serverTime: number;
  /** True while the snapshots come from the device's cache alone. */
  public fromCache = false;
  /** Transactions and server reads fail with `unavailable`. */
  public offline = false;
  /** Transactions never answer. */
  public hanging = false;
  /** Transactions commit, but their answer never arrives. */
  public lateCommit = false;
  /** `getDoc` and `getDocs` never answer. */
  public hangingReads = false;

  private readonly listeners = new Set<Listener>();
  private readonly values = new Map<string, unknown>();
  private readonly valueListeners = new Map<string, Set<() => void>>();
  private ids = 0;

  public constructor(options: FakeFirebaseOptions = {}) {
    for (const [path, data] of Object.entries(options.docs ?? {})) {
      this.docs.set(path, data);
    }
    this.refused = new Set(options.refused);
    this.serverTime = options.serverTime ?? FAKE_SERVER_TIME;
  }

  /** The SDK's Firestore calls the adapters use. */
  public readonly dbSdk = {
    Bytes: FakeBytes,
    Timestamp: FakeTimestamp,
    serverTimestamp: () => SERVER_TIMESTAMP,
    doc: (parent: unknown, ...segments: string[]): DocRef => {
      const base = (parent as Partial<CollectionRef>).path;
      if (segments.length === 0) {
        if (base === undefined) {
          throw new Error('doc() needs a path or a collection');
        }
        return this.docRef(`${base}/auto${++this.ids}`);
      }
      return this.docRef([base, ...segments].filter(Boolean).join('/'));
    },
    collection: (_db: unknown, ...segments: string[]): CollectionRef => {
      const path = segments.join('/');
      return { path, id: path.split('/').pop() ?? '', kind: 'collection' };
    },
    where: (field: string, op: string, value: unknown): Constraint => {
      if (!(op in OPERATORS)) {
        throw new Error(`The fake knows no where operator "${op}"`);
      }
      return { type: 'where', field, op, value };
    },
    orderBy: (
      field: string,
      direction: 'asc' | 'desc' = 'asc'
    ): Constraint => ({
      type: 'orderBy',
      field,
      direction,
    }),
    limit: (count: number): Constraint => ({ type: 'limit', count }),
    query: (
      collection: CollectionRef | QueryRef,
      ...constraints: Constraint[]
    ): QueryRef => {
      const all = [
        ...(collection.kind === 'query' ? collection.constraints : []),
        ...constraints,
      ];
      return { path: collection.path, kind: 'query', constraints: all };
    },
    getDoc: async (ref: DocRef): Promise<DocSnapshot> =>
      this.hangingReads ? never() : this.read(ref),
    getDocFromServer: async (ref: DocRef): Promise<DocSnapshot> => {
      if (this.offline) {
        throw firestoreError('unavailable');
      }
      return this.read(ref);
    },
    getDocs: async (ref: CollectionRef | QueryRef): Promise<QuerySnapshot> => {
      if (this.hangingReads) {
        return never();
      }
      this.logQuery(ref);
      this.check(ref.path);
      return this.listOf(ref);
    },
    setDoc: async (
      ref: DocRef,
      data: FakeDoc,
      options?: { merge?: boolean; mergeFields?: string[] }
    ): Promise<void> => {
      this.check(ref.path);
      this.set(ref.path, data, options);
    },
    updateDoc: async (ref: DocRef, data: FakeDoc): Promise<void> => {
      this.check(ref.path);
      this.update(ref.path, data);
    },
    deleteDoc: async (ref: DocRef): Promise<void> => {
      this.check(ref.path);
      this.remove(ref.path);
    },
    onSnapshot: (ref: Listened, ...args: unknown[]): (() => void) =>
      this.listen(ref, args),
    writeBatch: () => {
      const staged: Staged[] = [];
      return {
        set: (ref: DocRef, data: FakeDoc, options?: { merge?: boolean }) => {
          staged.push(() => this.set(ref.path, data, options));
        },
        update: (ref: DocRef, data: FakeDoc) => {
          staged.push(() => this.update(ref.path, data));
        },
        delete: (ref: DocRef) => {
          staged.push(() => this.remove(ref.path));
        },
        commit: async () => {
          staged.forEach((write) => write());
        },
      };
    },
    runTransaction: async <T>(
      _db: unknown,
      run: (transaction: unknown) => Promise<T>
    ): Promise<T> => this.transaction(run),
  };

  /** The SDK's Realtime Database calls the adapters use. */
  public readonly rtdbSdk = {
    ref: (_db: unknown, path: string) => ({ path }),
    onValue: (
      ref: { path: string },
      next: (snapshot: { val(): unknown }) => void
    ): (() => void) => {
      this.listened.push(`rtdb:${ref.path}`);
      const emit = () => next({ val: () => this.values.get(ref.path) ?? null });
      const emits = this.valueListeners.get(ref.path) ?? new Set();
      emits.add(emit);
      this.valueListeners.set(ref.path, emits);
      emit();
      return () => emits.delete(emit);
    },
  };

  /**
   * The connection an adapter takes - only its Firestore and Realtime
   * Database parts; `rtdb: false` stands for a project without one.
   */
  public connection({
    rtdb = true,
  }: { rtdb?: boolean } = {}): FirebaseConnection {
    return {
      db: {},
      dbSdk: this.dbSdk,
      rtdb: rtdb ? {} : null,
      rtdbSdk: this.rtdbSdk,
    } as unknown as FirebaseConnection;
  }

  /** Stores a document - or deletes it, for null - and tells the listeners. */
  public put(path: string, data: FakeDoc | null): void {
    if (data === null) {
      this.docs.delete(path);
    } else {
      this.docs.set(path, data);
    }
    this.pending.delete(path);
    this.tell(path);
  }

  /** Stores a Realtime Database value and tells its listeners. */
  public putValue(path: string, value: unknown): void {
    this.values.set(path, value);
    this.valueListeners.get(path)?.forEach((emit) => emit());
  }

  /** Tells every listener again, as a change of the metadata does. */
  public resend(): void {
    [...this.listeners].forEach((listener) => listener.emit());
  }

  /** The paths deleted, in order. */
  public deleted(): string[] {
    return this.writes
      .filter((write) => write.kind === 'delete')
      .map((write) => write.path);
  }

  private docRef(path: string): DocRef {
    return { path, id: path.split('/').pop() ?? '', kind: 'doc' };
  }

  private check(path: string): void {
    if (this.refused.has(path)) {
      throw firestoreError('permission-denied');
    }
  }

  private read(ref: DocRef): DocSnapshot {
    this.check(ref.path);
    return this.snapshot(ref.path);
  }

  private snapshot(path: string): DocSnapshot {
    const data = this.docs.get(path);
    return {
      id: path.split('/').pop() ?? '',
      ref: this.docRef(path),
      exists: () => data !== undefined,
      data: () => data,
      get: (field) => data?.[field],
      metadata: { fromCache: this.fromCache },
    };
  }

  /** The direct children of a collection, the query's constraints applied. */
  private listOf(ref: CollectionRef | QueryRef): QuerySnapshot {
    const prefix = `${ref.path}/`;
    let docs = [...this.docs.keys()]
      .filter(
        (path) =>
          path.startsWith(prefix) && !path.slice(prefix.length).includes('/')
      )
      .map((path) => this.snapshot(path));
    for (const constraint of ref.kind === 'query' ? ref.constraints : []) {
      if (constraint.type === 'where') {
        const matches = OPERATORS[constraint.op];
        docs = docs.filter((doc) =>
          matches(doc.get(constraint.field), constraint.value)
        );
      } else if (constraint.type === 'orderBy') {
        const sign = constraint.direction === 'desc' ? -1 : 1;
        docs = docs
          .filter((doc) => doc.get(constraint.field) !== undefined)
          .sort(
            (a, b) =>
              sign * compare(a.get(constraint.field), b.get(constraint.field))
          );
      } else {
        docs = docs.slice(0, constraint.count);
      }
    }
    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
      metadata: { fromCache: this.fromCache },
    };
  }

  private logQuery(ref: CollectionRef | QueryRef): void {
    if (ref.kind !== 'query') {
      return;
    }
    this.queries.push([
      ref.path,
      ...ref.constraints.map((constraint) => {
        switch (constraint.type) {
          case 'where':
            return ['where', constraint.field, constraint.op, constraint.value];
          case 'orderBy':
            return ['orderBy', constraint.field, constraint.direction];
          case 'limit':
            return ['limit', constraint.count];
        }
      }),
    ]);
  }

  /** `onSnapshot(ref, [options,] next, [error])`, emitting at once. */
  private listen(ref: Listened, args: unknown[]): () => void {
    const [next, error] = args.filter(
      (arg): arg is (value: unknown) => void => typeof arg === 'function'
    );
    this.listened.push(ref.path);
    if (ref.kind !== 'doc') {
      this.logQuery(ref);
    }
    let stopped = false;
    const listener: Listener = {
      ref,
      emit: () => {
        if (stopped) {
          return;
        }
        if (this.refused.has(ref.path)) {
          stopped = true;
          this.listeners.delete(listener);
          error?.(firestoreError('permission-denied'));
          return;
        }
        next?.(ref.kind === 'doc' ? this.snapshot(ref.path) : this.listOf(ref));
      },
    };
    this.listeners.add(listener);
    if (!this.pending.has(ref.path)) {
      listener.emit();
    }
    return () => {
      stopped = true;
      this.listeners.delete(listener);
    };
  }

  /** Tells each listener on the path, or on its collection. */
  private tell(path: string): void {
    const parent = path.slice(0, path.lastIndexOf('/'));
    // A copy: a listener that subscribes while told waits for the next write.
    for (const listener of Array.from(this.listeners)) {
      const listened = listener.ref;
      if (
        listened.path === path ||
        (listened.kind !== 'doc' && listened.path === parent)
      ) {
        listener.emit();
      }
    }
  }

  /** The data as stored: the server's time in place of `SERVER_TIMESTAMP`. */
  private stamped(data: FakeDoc): FakeDoc {
    const time = FakeTimestamp.fromMillis(this.serverTime);
    return Object.fromEntries(
      Object.entries(data).map(([field, value]) => [
        field,
        value === SERVER_TIMESTAMP ? time : value,
      ])
    );
  }

  private set(
    path: string,
    data: FakeDoc,
    options?: { merge?: boolean; mergeFields?: string[] }
  ): void {
    const stored = this.stamped(data);
    const fields =
      options?.mergeFields ?? (options?.merge ? Object.keys(data) : null);
    const doc =
      fields === null
        ? stored
        : {
            ...this.docs.get(path),
            ...Object.fromEntries(
              fields.map((field) => [field, stored[field]])
            ),
          };
    this.writes.push({ kind: 'set', path, data });
    this.store(path, doc);
  }

  private update(path: string, data: FakeDoc): void {
    const current = this.docs.get(path);
    if (current === undefined) {
      throw firestoreError('not-found');
    }
    this.writes.push({ kind: 'update', path, data });
    this.store(path, { ...current, ...this.stamped(data) });
  }

  private remove(path: string): void {
    this.writes.push({ kind: 'delete', path });
    this.docs.delete(path);
    this.tell(path);
  }

  private store(path: string, data: FakeDoc): void {
    this.docs.set(path, data);
    this.pending.delete(path);
    this.tell(path);
  }

  /** Reads go through, writes wait until `run` resolved: then all apply. */
  private async transaction<T>(
    run: (transaction: unknown) => Promise<T>
  ): Promise<T> {
    if (this.hanging) {
      return never();
    }
    if (this.offline) {
      throw firestoreError('unavailable');
    }
    const staged: Staged[] = [];
    const stage = (path: string, write: Staged) => {
      this.check(path);
      staged.push(write);
    };
    const transaction = {
      get: async (ref: DocRef) => this.read(ref),
      set: (ref: DocRef, data: FakeDoc, options?: { merge?: boolean }) =>
        stage(ref.path, () => this.set(ref.path, data, options)),
      update: (ref: DocRef, data: FakeDoc) =>
        stage(ref.path, () => this.update(ref.path, data)),
      delete: (ref: DocRef) => stage(ref.path, () => this.remove(ref.path)),
    };
    const result = await run(transaction);
    staged.forEach((write) => write());
    return this.lateCommit ? never() : result;
  }
}
