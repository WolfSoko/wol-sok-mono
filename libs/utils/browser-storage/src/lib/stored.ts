import { parseJson } from '@wolsok/utils-json';
import { isStorageFull } from './is-storage-full';

/** The part of a Web Storage (`localStorage`) the helpers use. */
export type KeyValueStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>;

/**
 * How a write ended: kept, refused because the storage is full, or
 * refused otherwise (blocked, private mode, no storage at all).
 */
export type StoreOutcome = 'stored' | 'full' | 'refused';

/**
 * The browser's `localStorage`, `undefined` where there is no window (a
 * server: a global `localStorage` there would be shared by every request)
 * or where the browser withholds it (blocked site data may throw on the
 * mere access).
 */
export function deviceStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined'
      ? undefined
      : (window.localStorage ?? undefined);
  } catch {
    return undefined;
  }
}

/** The text stored under `key`, null where there is none or no storage. */
export function readStored(
  key: string,
  storage: KeyValueStorage | undefined
): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Stores `value` under `key`, or removes the entry for null. A storage
 * that refuses keeps nothing and throws nothing: the outcome says so.
 */
export function writeStored(
  key: string,
  value: string | null,
  storage: KeyValueStorage | undefined
): StoreOutcome {
  if (storage === undefined) {
    return 'refused';
  }
  try {
    if (value === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, value);
    }
    return 'stored';
  } catch (error) {
    return isStorageFull(error) ? 'full' : 'refused';
  }
}

/**
 * The JSON value stored under `key`, null where there is none, it is
 * unreadable or there is no storage. The caller checks its shape.
 */
export function readStoredJson(
  key: string,
  storage: KeyValueStorage | undefined
): unknown {
  return parseJson(readStored(key, storage));
}

/**
 * Stores `value` as JSON under `key`. Only the storage's refusal is
 * swallowed: a value JSON cannot hold is the caller's bug and throws.
 */
export function writeStoredJson(
  key: string,
  value: unknown,
  storage: KeyValueStorage | undefined
): StoreOutcome {
  return writeStored(key, JSON.stringify(value), storage);
}
