/**
 * Local storage for the game's own keys. A browser that refuses storage -
 * private mode, a blocked site - or holds something unreadable under a key
 * reads as nothing stored, and a refused write keeps the value for the visit.
 */

/** The JSON stored under a key, null when there is none or it is unreadable. */
export function readStoredJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Stores a value as JSON under a key, if the browser lets it. */
export function storeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage refused - the value lasts for this visit only.
  }
}

/** True for anything a stored object's fields can be read from. */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null;
}
