export function notNil<T>(value: T): value is Exclude<T, null | undefined> {
  return !!(value ?? false);
}
