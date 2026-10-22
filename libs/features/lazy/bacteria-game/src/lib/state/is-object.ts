/** True for anything the fields of a stored or parsed object can be read from. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
