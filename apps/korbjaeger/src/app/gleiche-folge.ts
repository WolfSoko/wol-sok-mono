/**
 * Whether `a` and `b` hold equal entries in the same order, each pair
 * compared by `gleich` (by identity unless told otherwise). For a signal's
 * `equal`, so an equal list read anew changes nothing downstream.
 */
export function gleicheFolge<T>(
  a: readonly T[],
  b: readonly T[],
  gleich: (x: T, y: T) => boolean = Object.is
): boolean {
  return (
    a.length === b.length && a.every((eintrag, i) => gleich(eintrag, b[i]))
  );
}
