/** A `Storage` on a Map, as `localStorage` behaves, for specs. */
export function mapSpeicher(): Storage {
  const werte = new Map<string, string>();
  return {
    get length() {
      return werte.size;
    },
    clear: () => werte.clear(),
    getItem: (key) => werte.get(key) ?? null,
    key: (index) => [...werte.keys()][index] ?? null,
    removeItem: (key) => werte.delete(key),
    setItem: (key, value) => werte.set(key, String(value)),
  };
}

/** A `Storage` the browser blocks (site data off): every access throws. */
export const GESPERRTER_SPEICHER: Storage = {
  length: 0,
  clear: gesperrt,
  getItem: gesperrt,
  key: gesperrt,
  removeItem: gesperrt,
  setItem: gesperrt,
};

function gesperrt(): never {
  throw new DOMException('blocked', 'SecurityError');
}
