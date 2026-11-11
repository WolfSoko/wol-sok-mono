import { SELECTION_KEY } from '@wolsok/feat-korbjaeger-selection';
import {
  ANGEMELDET_SCHLUESSEL,
  DARSTELLUNG_SCHLUESSEL,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from './geraete-speicher';
import {
  dropKeysBeforeEnglishNames,
  KEYS_BEFORE_ENGLISH_NAMES as OLD,
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

  it('removes every key of before #2966, carrying only the two flags over', () => {
    oldDevice();

    dropKeysBeforeEnglishNames(localStorage);

    expect(Object.keys(localStorage).sort()).toEqual(
      [ANGEMELDET_SCHLUESSEL, ZWISCHENSPEICHER_LEEREN_SCHLUESSEL].sort()
    );
    expect(localStorage.getItem(ANGEMELDET_SCHLUESSEL)).toBe('1');
    expect(localStorage.getItem(ZWISCHENSPEICHER_LEEREN_SCHLUESSEL)).toBe('1');
  });

  it('leaves the keys of this version alone', () => {
    localStorage.setItem(SELECTION_KEY, '{"version":3}');
    localStorage.setItem(DARSTELLUNG_SCHLUESSEL, 'light');

    dropKeysBeforeEnglishNames(localStorage);

    expect(localStorage.getItem(SELECTION_KEY)).toBe('{"version":3}');
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
    } as unknown as Storage;

    expect(() => dropKeysBeforeEnglishNames(undefined)).not.toThrow();
    expect(() => dropKeysBeforeEnglishNames(refusing)).not.toThrow();
  });
});
