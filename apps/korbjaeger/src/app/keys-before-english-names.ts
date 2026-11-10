import {
  ANGEMELDET_SCHLUESSEL,
  flagGesetzt,
  flagSetzen,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from './geraete-speicher';

/**
 * The keys the app kept in `localStorage` before #2966 renamed them. #2983
 * removed their move; a device not started since still holds them, the
 * children's person ids and nicknames among them, which the privacy policy
 * no longer lists. So the start removes them.
 */
export const KEYS_BEFORE_ENGLISH_NAMES = {
  selection: 'korbjaeger-auswahl',
  signedIn: 'korbjaeger-angemeldet',
  clearCache: 'korbjaeger-zwischenspeicher-leeren',
  installDismissed: 'korbjaeger-installation-abgelehnt',
  theme: 'korbjaeger-darstellung',
  answerIndex: 'korbjaeger-antworten',
  answerPrefix: 'korbjaeger-antwort:',
} as const;

/** The flags that still matter, by the key that replaced each. */
const FLAGS_KEPT: readonly (readonly [string, string])[] = [
  [KEYS_BEFORE_ENGLISH_NAMES.signedIn, ANGEMELDET_SCHLUESSEL],
  // the privacy policy promises the pending clearing at the next start
  [KEYS_BEFORE_ENGLISH_NAMES.clearCache, ZWISCHENSPEICHER_LEEREN_SCHLUESSEL],
];

/** The part of the device's storage the removal uses. */
export type OldKeyStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;

/**
 * Removes every key of before #2966 from the device, before the app reads
 * any (`main.ts`). Only the two flags carry over (signed in, clear the
 * cache); the choices, the look and the cached answers go, as the issue
 * decided. Where the storage refuses, the keys wait for the next start.
 */
export function dropKeysBeforeEnglishNames(
  storage: OldKeyStorage | undefined
): void {
  if (storage === undefined) {
    return;
  }
  try {
    for (const [old, current] of FLAGS_KEPT) {
      if (flagGesetzt(storage, old)) {
        flagSetzen(storage, current, true);
      }
    }
    for (const key of oldKeys(storage)) {
      storage.removeItem(key);
    }
  } catch {
    // blocked: the keys wait for the next start
  }
}

function oldKeys(storage: OldKeyStorage): string[] {
  const { answerPrefix, ...named } = KEYS_BEFORE_ENGLISH_NAMES;
  const keys: string[] = Object.values(named);
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(answerPrefix)) {
      keys.push(key);
    }
  }
  return keys;
}
