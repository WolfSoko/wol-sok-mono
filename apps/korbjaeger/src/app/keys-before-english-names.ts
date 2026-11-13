import { SIGNED_IN_KEY, CLEAR_CACHE_KEY } from './device-storage';

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
  [KEYS_BEFORE_ENGLISH_NAMES.signedIn, SIGNED_IN_KEY],
  // the privacy policy promises the pending clearing at the next start
  [KEYS_BEFORE_ENGLISH_NAMES.clearCache, CLEAR_CACHE_KEY],
];

/**
 * Removes every key of before #2966 from the device, before the app reads
 * any (`main.ts`). Only the two flags carry over (signed in, clear the
 * cache); the choices, the look and the cached answers go, as the issue
 * decided. Where the storage refuses, the keys wait for the next start.
 */
export function dropKeysBeforeEnglishNames(storage: Storage | undefined): void {
  if (storage === undefined) {
    return;
  }
  try {
    for (const [old, current] of FLAGS_KEPT) {
      if (storage.getItem(old) === '1') {
        storage.setItem(current, '1');
      }
    }
    for (const key of oldKeys(storage)) {
      storage.removeItem(key);
    }
  } catch {
    // blocked or full: the keys left wait for the next start
  }
}

function oldKeys(storage: Storage): string[] {
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
