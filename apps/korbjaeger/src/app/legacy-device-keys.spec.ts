import {
  SELECTION_KEY,
  LocalSelection,
} from '@wolsok/feat-korbjaeger-selection';
import { ANSWER_INDEX } from '@wolsok/feat-korbjaeger-answers';
import {
  ANGEMELDET_SCHLUESSEL,
  DARSTELLUNG_SCHLUESSEL,
  INSTALLATION_ABGELEHNT_SCHLUESSEL,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from './geraete-speicher';
import {
  LEGACY_DEVICE_KEYS,
  type LegacyKeyStorage,
  moveLegacyDeviceKeys,
} from './legacy-device-keys';

/** A device as the app before #2966 left it. */
function legacyDevice(): void {
  localStorage.setItem(
    LEGACY_DEVICE_KEYS.selection,
    JSON.stringify({
      version: 2,
      teams: { 313036: 1, 201500: 2 },
      kinder: { 4711: { seit: 3, spitzname: 'Mimi' } },
    })
  );
  localStorage.setItem(LEGACY_DEVICE_KEYS.signedIn, '1');
  localStorage.setItem(LEGACY_DEVICE_KEYS.clearCache, '1');
  localStorage.setItem(LEGACY_DEVICE_KEYS.installDismissed, '1');
  localStorage.setItem(LEGACY_DEVICE_KEYS.theme, 'dark');
  localStorage.setItem(`${LEGACY_DEVICE_KEYS.answerPrefix}/api/dbb/x`, '{}');
  localStorage.setItem(LEGACY_DEVICE_KEYS.answerIndex, '{}');
}

describe('moveLegacyDeviceKeys', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the same choices, signed in, the same look and flags, under the new keys', () => {
    legacyDevice();

    moveLegacyDeviceKeys(localStorage);

    expect(localStorage.getItem(ANGEMELDET_SCHLUESSEL)).toBe('1');
    expect(localStorage.getItem(ZWISCHENSPEICHER_LEEREN_SCHLUESSEL)).toBe('1');
    expect(localStorage.getItem(INSTALLATION_ABGELEHNT_SCHLUESSEL)).toBe('1');
    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBe('dark');
    const auswahl = new LocalSelection(localStorage);
    expect(auswahl.teams()).toEqual([313036, 201500]);
    expect(auswahl.children()).toEqual([{ personId: 4711, nickname: 'Mimi' }]);
  });

  it('removes every legacy key and the cached answers of before', () => {
    legacyDevice();

    moveLegacyDeviceKeys(localStorage);

    expect(Object.keys(localStorage).sort()).toEqual(
      [
        SELECTION_KEY,
        ANGEMELDET_SCHLUESSEL,
        ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
        INSTALLATION_ABGELEHNT_SCHLUESSEL,
        DARSTELLUNG_SCHLUESSEL,
      ].sort()
    );
    expect(localStorage.getItem(ANSWER_INDEX)).toBeNull();
  });

  it('keeps a value stored under the new key already', () => {
    localStorage.setItem(DARSTELLUNG_SCHLUESSEL, 'light');
    localStorage.setItem(LEGACY_DEVICE_KEYS.theme, 'dark');

    moveLegacyDeviceKeys(localStorage);

    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBe('light');
    expect(localStorage.getItem(LEGACY_DEVICE_KEYS.theme)).toBeNull();
  });

  it('keeps the legacy keys where the storage refuses to write, for the next start', () => {
    legacyDevice();
    const speicher: LegacyKeyStorage = {
      getItem: (key) => localStorage.getItem(key),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
      removeItem: (key) => localStorage.removeItem(key),
      key: (index) => localStorage.key(index),
      get length() {
        return localStorage.length;
      },
    };

    moveLegacyDeviceKeys(speicher);

    expect(localStorage.getItem(LEGACY_DEVICE_KEYS.selection)).not.toBeNull();
    expect(localStorage.getItem(LEGACY_DEVICE_KEYS.signedIn)).toBe('1');
    expect(localStorage.getItem(ANGEMELDET_SCHLUESSEL)).toBeNull();
  });

  it('does nothing without storage', () => {
    expect(() => moveLegacyDeviceKeys(undefined)).not.toThrow();
  });
});
