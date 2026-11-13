/**
 * An entry for each of `keys`, in their order: those in `vorher` kept,
 * the others made by `lesen`; the entries of `vorher` no key names are
 * handed to `ende`.
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
