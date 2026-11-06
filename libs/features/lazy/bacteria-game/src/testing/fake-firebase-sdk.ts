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
    // Rounded, not floored as the SDK does: a float of ms cannot hold every
    // nanosecond, and rounding gives back those a `toMillis()` came from.
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
  /** Told of metadata changes too (`includeMetadataChanges`). */
  metadata: boolean;
  emit(): void;
}

/** A write staged by a transaction or a batch, applied at its commit. */
interface Staged {
  path: string;
  /** An update: the document has to be there at the commit. */
  needsDoc: boolean;
  apply(): void;
}

/**
 * Lets the snapshots the fake queued so far reach their listeners: like the
 * SDK, the fake calls a listener back asynchronously, never inside the call
 * that caused it.
 */
export async function settleSnapshots(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    await Promise.resolve();
  }
}

/** An error with the code the SDK gives it. */
function firestoreError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

/**
 * Runs the callback in a microtask - through a promise, not
 * `queueMicrotask`, which Jest's fake timers hold back.
 */
function later(callback: () => void): void {
  void Promise.resolve().then(callback);
}

/** A promise that never settles: a call whose answer never arrives. */
function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

/** A field value's type, as Firestore orders and compares by it. */
function typeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value instanceof FakeTimestamp) {
    return 'timestamp';
  }
  return Array.isArray(value) ? 'array' : typeof value;
}

/** Whether two values compare at all: Firestore never compares across types. */
function comparable(a: unknown, b: unknown): boolean {
  const type = typeOf(a);
  return (
    type === typeOf(b) &&
    ['number', 'string', 'boolean', 'timestamp'].includes(type)
  );
}

/** Orders two comparable values, timestamps by their time. */
function compare(a: unknown, b: unknown): number {
  const left = a instanceof FakeTimestamp ? a.toMillis() : a;
  const right = b instanceof FakeTimestamp ? b.toMillis() : b;
  if (left === right) {
    return 0;
  }
  return (left as number | string) < (right as number | string) ? -1 : 1;
}

/** Equality by value, arrays and maps included, never across types. */
function equal(a: unknown, b: unknown): boolean {
  if (typeOf(a) !== typeOf(b)) {
    return false;
  }
  return comparable(a, b)
    ? compare(a, b) === 0
    : JSON.stringify(a) === JSON.stringify(b);
}

/** A range filter: only a field of the value's own type matches. */
const range =
  (holds: (order: number) => boolean) => (field: unknown, value: unknown) =>
    comparable(field, value) && holds(compare(field, value));

const OPERATORS: Record<string, (field: unknown, value: unknown) => boolean> = {
  '==': equal,
  '<': range((order) => order < 0),
  '<=': range((order) => order <= 0),
  '>': range((order) => order > 0),
  '>=': range((order) => order >= 0),
  'array-contains': (field, value) =>
    Array.isArray(field) && field.some((each) => equal(each, value)),
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
          staged.push(this.stagedSet(ref.path, data, options));
        },
        update: (ref: DocRef, data: FakeDoc) => {
          staged.push(this.stagedUpdate(ref.path, data));
        },
        delete: (ref: DocRef) => {
          staged.push(this.stagedDelete(ref.path));
        },
        commit: async () => this.commit(staged),
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
      const emit = () =>
        later(() => next({ val: () => this.values.get(ref.path) ?? null }));
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

  /**
   * Tells the listeners that take metadata changes again, as a change of
   * `fromCache` does.
   */
  public resend(): void {
    Array.from(this.listeners)
      .filter((listener) => listener.metadata)
      .forEach((listener) => listener.emit());
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
    const constraints = ref.kind === 'query' ? ref.constraints : [];
    const orders = constraints.filter(
      (constraint) => constraint.type === 'orderBy'
    );
    // As Firestore: filters first, a document without an ordered field left
    // out, sorted by the first orderBy, then the next; the limit last.
    let docs = [...this.docs.keys()]
      .filter(
        (path) =>
          path.startsWith(prefix) && !path.slice(prefix.length).includes('/')
      )
      .map((path) => this.snapshot(path))
      .filter((doc) =>
        constraints.every(
          (constraint) =>
            constraint.type !== 'where' ||
            OPERATORS[constraint.op](
              doc.get(constraint.field),
              constraint.value
            )
        )
      )
      .filter((doc) =>
        orders.every((order) => doc.get(order.field) !== undefined)
      )
      .sort((a, b) => {
        for (const order of orders) {
          const sign = order.direction === 'desc' ? -1 : 1;
          const left = a.get(order.field);
          const right = b.get(order.field);
          const ordered = comparable(left, right)
            ? compare(left, right)
            : compare(typeOf(left), typeOf(right));
          if (ordered !== 0) {
            return sign * ordered;
          }
        }
        return 0;
      });
    for (const constraint of constraints) {
      if (constraint.type === 'limit') {
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

  /** `onSnapshot(ref, [options,] next, [error])`, telling the first snapshot soon. */
  private listen(ref: Listened, args: unknown[]): () => void {
    if (
      args.some(
        (arg) => typeof arg === 'object' && arg !== null && 'next' in arg
      )
    ) {
      throw new Error('The fake takes onSnapshot callbacks, not an observer');
    }
    const [next, error] = args.filter(
      (arg): arg is (value: unknown) => void => typeof arg === 'function'
    );
    const options = args.find(
      (arg): arg is { includeMetadataChanges?: boolean } =>
        typeof arg === 'object' && arg !== null
    );
    this.listened.push(ref.path);
    if (ref.kind !== 'doc') {
      this.logQuery(ref);
    }
    let stopped = false;
    const tellNow = () => {
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
    };
    const listener: Listener = {
      ref,
      metadata: options?.includeMetadataChanges === true,
      emit: () => later(tellNow),
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
    const transaction = {
      get: async (ref: DocRef) => this.read(ref),
      set: (ref: DocRef, data: FakeDoc, options?: { merge?: boolean }) => {
        staged.push(this.stagedSet(ref.path, data, options));
      },
      update: (ref: DocRef, data: FakeDoc) => {
        staged.push(this.stagedUpdate(ref.path, data));
      },
      delete: (ref: DocRef) => {
        staged.push(this.stagedDelete(ref.path));
      },
    };
    const result = await run(transaction);
    this.commit(staged);
    return this.lateCommit ? never() : result;
  }

  private stagedSet(
    path: string,
    data: FakeDoc,
    options?: { merge?: boolean; mergeFields?: string[] }
  ): Staged {
    return {
      path,
      needsDoc: false,
      apply: () => this.set(path, data, options),
    };
  }

  private stagedUpdate(path: string, data: FakeDoc): Staged {
    return { path, needsDoc: true, apply: () => this.update(path, data) };
  }

  private stagedDelete(path: string): Staged {
    return { path, needsDoc: false, apply: () => this.remove(path) };
  }

  /**
   * Applies the staged writes all or none: every path is checked against
   * the rules, and every update against its document, before the first one.
   */
  private commit(staged: Staged[]): void {
    const present = new Set(this.docs.keys());
    for (const write of staged) {
      this.check(write.path);
      if (write.needsDoc && !present.has(write.path)) {
        throw firestoreError('not-found');
      }
      present.add(write.path);
    }
    staged.forEach((write) => write.apply());
  }
}
