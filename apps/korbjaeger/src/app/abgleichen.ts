/**
 * An entry for each of `keys`, in their order: those in `vorher` kept,
 * the others made by `lesen`; the entries of `vorher` no key names are
 * handed to `ende`.
 */
export function abgleichen<K, V>(
  vorher: ReadonlyMap<K, V>,
  keys: Iterable<K>,
  lesen: (key: K) => V,
  ende: (eintrag: V) => void
): ReadonlyMap<K, V> {
  const gesucht = new Set(keys);
  for (const [key, eintrag] of vorher) {
    if (!gesucht.has(key)) {
      ende(eintrag);
    }
  }
  return new Map(
    [...gesucht].map((key) => [key, vorher.get(key) ?? lesen(key)])
  );
}
