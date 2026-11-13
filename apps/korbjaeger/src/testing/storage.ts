/** A `Storage` on a Map, as `localStorage` behaves, for specs. */
export function mapStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

/** A `Storage` the browser blocks (site data off): every access throws. */
export const BLOCKED_STORAGE: Storage = {
  length: 0,
  clear: blocked,
  getItem: blocked,
  key: blocked,
  removeItem: blocked,
  setItem: blocked,
};

function blocked(): never {
  throw new DOMException('blocked', 'SecurityError');
}
