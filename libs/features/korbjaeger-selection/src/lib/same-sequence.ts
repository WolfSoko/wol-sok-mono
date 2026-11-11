/**
 * Whether `a` and `b` hold equal entries in the same order, each pair
 * compared by `gleich` (by identity unless told otherwise). For a signal's
 * `equal`, so an equal list read anew changes nothing downstream.
 */
export function sameSequence<T>(
  a: readonly T[],
  b: readonly T[],
  equal: (x: T, y: T) => boolean = Object.is
): boolean {
  return a.length === b.length && a.every((entry, i) => equal(entry, b[i]));
}
