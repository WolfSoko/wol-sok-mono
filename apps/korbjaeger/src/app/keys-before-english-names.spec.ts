import { AUSWAHL_SCHLUESSEL } from '@wolsok/feat-korbjaeger-auswahl';
import {
  ANGEMELDET_SCHLUESSEL,
  DARSTELLUNG_SCHLUESSEL,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from './geraete-speicher';
import {
  dropKeysBeforeEnglishNames,
  KEYS_BEFORE_ENGLISH_NAMES as OLD,
  type OldKeyStorage,
} from './keys-before-english-names';

/** A device as the app before #2966 left it. */
function oldDevice(): void {
  localStorage.setItem(
    OLD.selection,
    JSON.stringify({
      version: 2,
      kinder: { 4711: { seit: 3, spitzname: 'Mimi' } },
    })
  );
  localStorage.setItem(OLD.signedIn, '1');
  localStorage.setItem(OLD.clearCache, '1');
  localStorage.setItem(OLD.installDismissed, '1');
  localStorage.setItem(OLD.theme, 'dark');
  localStorage.setItem(`${OLD.answerPrefix}/api/dbb/x`, '{}');
  localStorage.setItem(OLD.answerIndex, '{}');
}

describe('dropKeysBeforeEnglishNames', () => {
  beforeEach(() => localStorage.clear());

  it('removes every key of before #2966, the choices too', () => {
    oldDevice();

    dropKeysBeforeEnglishNames(localStorage);

    const left = Object.keys(localStorage);
    expect(left.filter((key) => key.startsWith('korbjaeger-antwort'))).toEqual(
      []
    );
    for (const key of Object.values(OLD)) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.getItem(AUSWAHL_SCHLUESSEL)).toBeNull();
    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBeNull();
  });

  it('carries the signed-in and clear-cache flags over', () => {
    oldDevice();

    dropKeysBeforeEnglishNames(localStorage);

    expect(localStorage.getItem(ANGEMELDET_SCHLUESSEL)).toBe('1');
    expect(localStorage.getItem(ZWISCHENSPEICHER_LEEREN_SCHLUESSEL)).toBe('1');
  });

  it('leaves the keys of this version alone', () => {
    localStorage.setItem(AUSWAHL_SCHLUESSEL, '{"version":3}');
    localStorage.setItem(DARSTELLUNG_SCHLUESSEL, 'light');

    dropKeysBeforeEnglishNames(localStorage);

    expect(localStorage.getItem(AUSWAHL_SCHLUESSEL)).toBe('{"version":3}');
    expect(localStorage.getItem(DARSTELLUNG_SCHLUESSEL)).toBe('light');
    expect(localStorage.getItem(ANGEMELDET_SCHLUESSEL)).toBeNull();
  });

  it('never throws where the storage is withheld or refuses', () => {
    const refusing = {
      length: 1,
      key: () => {
        throw new Error('blocked');
      },
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    } satisfies OldKeyStorage;

    expect(() => dropKeysBeforeEnglishNames(undefined)).not.toThrow();
    expect(() => dropKeysBeforeEnglishNames(refusing)).not.toThrow();
  });
});
