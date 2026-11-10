/** The names a full storage's `DOMException` carries (Firefox has its own). */
const STORAGE_FULL_NAMES: ReadonlySet<string> = new Set([
  'QuotaExceededError',
  'NS_ERROR_DOM_QUOTA_REACHED',
]);

/** Whether `error` says the device's storage is full. */
export function isStorageFull(error: unknown): boolean {
  return error instanceof DOMException && STORAGE_FULL_NAMES.has(error.name);
}
