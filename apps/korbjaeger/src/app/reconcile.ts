/**
 * An entry for each of `keys`, in their order: those in `before` kept,
 * the others made by `read`; the entries of `before` no key names are
 * handed to `end`.
 */
export function reconcile<K, V>(
  before: ReadonlyMap<K, V>,
  keys: Iterable<K>,
  read: (key: K) => V,
  end: (entry: V) => void
): ReadonlyMap<K, V> {
  const wanted = new Set(keys);
  for (const [key, entry] of before) {
    if (!wanted.has(key)) {
      end(entry);
    }
  }
  return new Map([...wanted].map((key) => [key, before.get(key) ?? read(key)]));
}
