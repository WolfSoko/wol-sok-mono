import {
  LEGACY_SELECTION_KEY,
  moveLegacyDeviceSelection,
} from '@wolsok/feat-korbjaeger-selection';
import {
  ANGEMELDET_SCHLUESSEL,
  DARSTELLUNG_SCHLUESSEL,
  INSTALLATION_ABGELEHNT_SCHLUESSEL,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from './geraete-speicher';

/**
 * The keys the app kept in `localStorage` before #2966, by the key that
 * replaced each: read once at start (`moveLegacyDeviceKeys`) and removed.
 * Gone with the follow-up of #2966.
 */
export const LEGACY_DEVICE_KEYS = {
  selection: LEGACY_SELECTION_KEY,
  signedIn: 'korbjaeger-angemeldet',
  clearCache: 'korbjaeger-zwischenspeicher-leeren',
  installDismissed: 'korbjaeger-installation-abgelehnt',
  theme: 'korbjaeger-darstellung',
  answerPrefix: 'korbjaeger-antwort:',
  answerIndex: 'korbjaeger-antworten',
} as const;

/** Each legacy key whose value moves as it is, to its new key. */
const MOVED_AS_THEY_ARE: readonly (readonly [string, string])[] = [
  [LEGACY_DEVICE_KEYS.signedIn, ANGEMELDET_SCHLUESSEL],
  [LEGACY_DEVICE_KEYS.clearCache, ZWISCHENSPEICHER_LEEREN_SCHLUESSEL],
  [LEGACY_DEVICE_KEYS.installDismissed, INSTALLATION_ABGELEHNT_SCHLUESSEL],
  [LEGACY_DEVICE_KEYS.theme, DARSTELLUNG_SCHLUESSEL],
];

/** The part of the device's storage the move uses. */
export type LegacyKeyStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;

/**
 * Moves what the device keeps under the keys before #2966 to the new
 * ones, before the app reads any (`main.ts`). First it drops the cached
 * DBB answers (a cache the next read fills again), which frees space; then
 * each flag and the look go to their new key where that holds nothing yet,
 * and the selection is converted (`moveLegacyDeviceSelection`). A legacy
 * key goes only once its value is written; where a write fails (storage
 * full or blocked), it stays for the next start.
 */
export function moveLegacyDeviceKeys(
  storage: LegacyKeyStorage | undefined
): void {
  if (storage === undefined) {
    return;
  }
  attempt(() => dropLegacyAnswers(storage));
  for (const [legacy, current] of MOVED_AS_THEY_ARE) {
    attempt(() => moveKey(storage, legacy, current));
  }
  moveLegacyDeviceSelection(storage);
}

/** Runs `step`; where the storage refuses it, it waits for the next start. */
function attempt(step: () => void): void {
  try {
    step();
  } catch {
    // blocked or full: the legacy key stays
  }
}

function dropLegacyAnswers(storage: LegacyKeyStorage): void {
  const answers: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(LEGACY_DEVICE_KEYS.answerPrefix)) {
      answers.push(key);
    }
  }
  for (const key of [...answers, LEGACY_DEVICE_KEYS.answerIndex]) {
    storage.removeItem(key);
  }
}

function moveKey(
  storage: LegacyKeyStorage,
  legacy: string,
  current: string
): void {
  const value = storage.getItem(legacy);
  if (value === null) {
    return;
  }
  if (storage.getItem(current) === null) {
    storage.setItem(current, value);
  }
  storage.removeItem(legacy);
}
