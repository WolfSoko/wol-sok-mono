/**
 * `table[key]` where `table` has `key` itself, `undefined` otherwise: a key
 * from the DBB such as `constructor` must not find an inherited member.
 */
export function ownValue<V>(
  table: Readonly<Record<string, V>>,
  key: string
): V | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
