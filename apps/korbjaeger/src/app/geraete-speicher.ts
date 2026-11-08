import { InjectionToken } from '@angular/core';

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

/**
 * Frees the device's storage of what may give way (the cached DBB
 * answers), for what must not (Meine Teams). Nothing by default.
 */
export const SPEICHER_FREIGEBEN = new InjectionToken<() => void>(
  'SPEICHER_FREIGEBEN',
  { providedIn: 'root', factory: () => () => undefined }
);
