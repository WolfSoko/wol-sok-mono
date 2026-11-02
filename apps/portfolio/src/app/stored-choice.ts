/**
 * A choice kept in `localStorage` between visits. Both read and write
 * swallow what the browser may throw (private mode, storage blocked) and
 * do nothing on the server, where there is no storage: the choice then
 * holds for the visit only.
 */
export function readStored(key: string): string | null {
  try {
    return typeof localStorage === 'undefined'
      ? null
      : localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Stores `value`, or removes the entry for null. */
export function writeStored(key: string, value: string | null): void {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    // private mode or storage blocked: the choice holds for this visit
  }
}
