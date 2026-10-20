/**
 * Remembers the value under the key in a cache that keeps only the `limit`
 * latest entries, letting the oldest go. Returns the value.
 */
export function keepRecent<K, V>(
  cache: Map<K, V>,
  key: K,
  value: V,
  limit: number
): V {
  cache.set(key, value);
  if (cache.size > limit) {
    cache.delete(cache.keys().next().value as K);
  }
  return value;
}
