/**
 * Whether `error` says the device's storage is full (Firefox names it its
 * own way).
 */
export function istSpeicherVoll(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
