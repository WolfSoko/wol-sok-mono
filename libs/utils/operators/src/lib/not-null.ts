export function notNull<T>(value: T): value is Exclude<T, null | undefined> {
  return !!(value ?? false);
}
