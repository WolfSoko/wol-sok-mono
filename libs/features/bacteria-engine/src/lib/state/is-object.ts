/** True for anything the fields of a stored or parsed object can be read from. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}

/** True for a whole number from `min` to `max` - above 0 with `min` 1. */
export function isInteger(
  value: unknown,
  min = -Infinity,
  max = Infinity
): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}
