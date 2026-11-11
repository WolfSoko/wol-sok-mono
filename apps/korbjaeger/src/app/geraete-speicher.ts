import { InjectionToken } from '@angular/core';
import {
  KeyValueStorage,
  readStored,
  writeStored,
} from '@wolsok/utils-browser-storage';

/** Tells, on the device, that an Elternteil is signed in. */
export const ANGEMELDET_SCHLUESSEL = 'korbjaeger-signed-in';

/**
 * Set where signing out could not clear Firestore's copy on the device
 * (another tab held it, or clearing failed): the next start clears it,
 * signed in or not, without loading Firebase to read this.
 */
export const ZWISCHENSPEICHER_LEEREN_SCHLUESSEL = 'korbjaeger-clear-cache';

/** Set once the install hint was dismissed, for good. */
export const INSTALLATION_ABGELEHNT_SCHLUESSEL = 'korbjaeger-install-dismissed';

/**
 * The look the Elternteil chose (`light` or `dark`; none for following the
 * device), read by the pre-paint script in `index.html` too.
 */
export const DARSTELLUNG_SCHLUESSEL = 'korbjaeger-theme';

/** Whether the flag `schluessel` is set (`'1'`); not where storage is withheld. */
export function flagGesetzt(
  speicher: KeyValueStorage | undefined,
  schluessel: string
): boolean {
  return readStored(schluessel, speicher) === '1';
}

/**
 * Sets the flag `schluessel` (`'1'`) or clears it; where storage is full
 * or withheld, nothing is kept and the caller carries on.
 */
export function flagSetzen(
  speicher: KeyValueStorage | undefined,
  schluessel: string,
  gesetzt: boolean
): void {
  writeStored(schluessel, gesetzt ? '1' : null, speicher);
}

/**
 * Frees the device's storage of what may give way (the cached DBB
 * answers), for what must not (Meine Teams). Nothing by default.
 */
export const SPEICHER_FREIGEBEN = new InjectionToken<() => void>(
  'SPEICHER_FREIGEBEN',
  { providedIn: 'root', factory: () => () => undefined }
);
