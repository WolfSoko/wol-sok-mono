import { legacySelection } from './legacy-selection';
import { AUSWAHL_SCHLUESSEL } from './lokale-auswahl';

/** The key versions 1 and 2 kept the device's selection under. */
export const LEGACY_SELECTION_KEY = 'korbjaeger-auswahl';

/**
 * Moves the device's legacy selection (`LEGACY_SELECTION_KEY`, German
 * fields) to `AUSWAHL_SCHLUESSEL` as this version's document (#2966), before
 * `LokaleAuswahl` reads it. The legacy key goes once the new one is
 * written; where that fails (storage full or blocked), it stays for the
 * next start. Where the new key holds a selection already, or the legacy
 * one none that can be read, the legacy key just goes.
 */
export function moveLegacyDeviceSelection(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): void {
  try {
    const legacy = storage.getItem(LEGACY_SELECTION_KEY);
    if (legacy === null) {
      return;
    }
    const document =
      storage.getItem(AUSWAHL_SCHLUESSEL) === null
        ? legacySelection(parsed(legacy))
        : undefined;
    if (document !== undefined) {
      storage.setItem(AUSWAHL_SCHLUESSEL, JSON.stringify(document));
    }
    storage.removeItem(LEGACY_SELECTION_KEY);
  } catch {
    // blocked or full: the legacy key waits for the next start
  }
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
