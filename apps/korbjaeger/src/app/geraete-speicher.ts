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

/** Tells, on the device, that an Elternteil is signed in. */
export const ANGEMELDET_SCHLUESSEL = 'korbjaeger-angemeldet';

/**
 * Set where signing out could not clear Firestore's copy on the device
 * (another tab held it, or clearing failed): the next start clears it,
 * signed in or not, without loading Firebase to read this.
 */
export const ZWISCHENSPEICHER_LEEREN_SCHLUESSEL =
  'korbjaeger-zwischenspeicher-leeren';

/** Set once the install hint was dismissed, for good. */
export const INSTALLATION_ABGELEHNT_SCHLUESSEL =
  'korbjaeger-installation-abgelehnt';

/**
 * The look the Elternteil chose (`light` or `dark`; none for following the
 * device), read by the pre-paint script in `index.html` too.
 */
export const DARSTELLUNG_SCHLUESSEL = 'korbjaeger-darstellung';

/** Whether the flag `schluessel` is set (`'1'`); not where storage is withheld. */
export function flagGesetzt(
  speicher: Pick<Storage, 'getItem'> | undefined,
  schluessel: string
): boolean {
  try {
    return speicher?.getItem(schluessel) === '1';
  } catch {
    return false;
  }
}

/**
 * Sets the flag `schluessel` (`'1'`) or clears it; where storage is full
 * or withheld, nothing is kept and the caller carries on.
 */
export function flagSetzen(
  speicher: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
  schluessel: string,
  gesetzt: boolean
): void {
  try {
    if (gesetzt) {
      speicher?.setItem(schluessel, '1');
    } else {
      speicher?.removeItem(schluessel);
    }
  } catch {
    // full or blocked: the flag lasts no longer than this visit's state
  }
}

/**
 * Frees the device's storage of what may give way (the cached DBB
 * answers), for what must not (Meine Teams). Nothing by default.
 */
export const SPEICHER_FREIGEBEN = new InjectionToken<() => void>(
  'SPEICHER_FREIGEBEN',
  { providedIn: 'root', factory: () => () => undefined }
);
