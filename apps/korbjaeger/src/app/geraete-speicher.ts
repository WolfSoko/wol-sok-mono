/**
 * The device's `localStorage`, or `undefined` where the browser withholds
 * it (blocked site data may throw on the mere access).
 */
export function geraeteSpeicher(): Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}
