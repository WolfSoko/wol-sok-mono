import {
  deviceStorage,
  KeyValueStorage,
  readStored,
  readStoredJson,
  writeStored,
  writeStoredJson,
} from './stored';

/** A `localStorage` in memory. */
function memoryStorage(): KeyValueStorage & { entries: Map<string, string> } {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
}

/** A storage whose every call throws `error`. */
function throwingStorage(error: unknown): KeyValueStorage {
  const fail = (): never => {
    throw error;
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

const BLOCKED = new DOMException('blocked', 'SecurityError');
const FULL = new DOMException('full', 'QuotaExceededError');

describe('deviceStorage', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('is undefined without a window, as on a server', () => {
    expect(deviceStorage()).toBeUndefined();
  });

  it("is the window's localStorage", () => {
    const storage = memoryStorage();
    Object.assign(globalThis, { window: { localStorage: storage } });
    expect(deviceStorage()).toBe(storage);
  });

  it('is undefined where the access throws', () => {
    Object.assign(globalThis, {
      window: {
        get localStorage(): Storage {
          throw BLOCKED;
        },
      },
    });
    expect(deviceStorage()).toBeUndefined();
  });
});

describe('readStored', () => {
  it('reads the stored text', () => {
    const storage = memoryStorage();
    storage.setItem('k', 'v');
    expect(readStored('k', storage)).toBe('v');
  });

  it('is null for a missing key, no storage or a throwing one', () => {
    expect(readStored('k', memoryStorage())).toBeNull();
    expect(readStored('k', undefined)).toBeNull();
    expect(readStored('k', throwingStorage(BLOCKED))).toBeNull();
  });
});

describe('writeStored', () => {
  it('stores the text', () => {
    const storage = memoryStorage();
    expect(writeStored('k', 'v', storage)).toBe('stored');
    expect(storage.entries.get('k')).toBe('v');
  });

  it('removes the entry for null', () => {
    const storage = memoryStorage();
    storage.setItem('k', 'v');
    expect(writeStored('k', null, storage)).toBe('stored');
    expect(storage.entries.has('k')).toBe(false);
  });

  it('says full where the storage is full', () => {
    expect(writeStored('k', 'v', throwingStorage(FULL))).toBe('full');
  });

  it('says refused where the storage is blocked or missing', () => {
    expect(writeStored('k', 'v', throwingStorage(BLOCKED))).toBe('refused');
    expect(writeStored('k', null, throwingStorage(BLOCKED))).toBe('refused');
    expect(writeStored('k', 'v', undefined)).toBe('refused');
  });
});

describe('readStoredJson and writeStoredJson', () => {
  it('round-trips a value', () => {
    const storage = memoryStorage();
    expect(writeStoredJson('k', { a: [1, 2] }, storage)).toBe('stored');
    expect(readStoredJson('k', storage)).toEqual({ a: [1, 2] });
  });

  it('reads null for unreadable JSON or a blocked storage', () => {
    const storage = memoryStorage();
    storage.setItem('k', '{not json');
    expect(readStoredJson('k', storage)).toBeNull();
    expect(readStoredJson('k', throwingStorage(BLOCKED))).toBeNull();
  });

  it('throws for a value JSON cannot hold', () => {
    expect(() => writeStoredJson('k', 1n, memoryStorage())).toThrow();
  });
});
