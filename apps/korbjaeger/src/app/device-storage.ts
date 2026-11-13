import { InjectionToken } from '@angular/core';
import {
  KeyValueStorage,
  readStored,
  writeStored,
} from '@wolsok/utils-browser-storage';

/** Tells, on the device, that an Elternteil is signed in. */
export const SIGNED_IN_KEY = 'korbjaeger-signed-in';

/**
 * Set where signing out could not clear Firestore's copy on the device
 * (another tab held it, or clearing failed): the next start clears it,
 * signed in or not, without loading Firebase to read this.
 */
export const CLEAR_CACHE_KEY = 'korbjaeger-clear-cache';

/** Set once the install hint was dismissed, for good. */
export const INSTALL_DISMISSED_KEY = 'korbjaeger-install-dismissed';

/**
 * The look the Elternteil chose (`light` or `dark`; none for following the
 * device), read by the pre-paint script in `index.html` too.
 */
export const APPEARANCE_KEY = 'korbjaeger-theme';

/** Whether the flag `key` is set (`'1'`); not where storage is withheld. */
export function isFlagSet(
  storage: KeyValueStorage | undefined,
  key: string
): boolean {
  return readStored(key, storage) === '1';
}

/**
 * Sets the flag `key` (`'1'`) or clears it; where storage is full
 * or withheld, nothing is kept and the caller carries on.
 */
export function setFlag(
  storage: KeyValueStorage | undefined,
  key: string,
  set: boolean
): void {
  writeStored(key, set ? '1' : null, storage);
}

/**
 * Frees the device's storage of what may give way (the cached DBB
 * answers), for what must not (Meine Teams). Nothing by default.
 */
export const FREE_STORAGE = new InjectionToken<() => void>('FREE_STORAGE', {
  providedIn: 'root',
  factory: () => () => undefined,
});
