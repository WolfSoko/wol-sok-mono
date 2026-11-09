import { TestBed } from '@angular/core/testing';
import { ANGEMELDET_SCHLUESSEL, geraeteMerker, KONTO_SITZUNG } from './konto';

describe('geraeteMerker', () => {
  afterEach(() => localStorage.clear());

  it("remembers the sign-in in the device's storage", () => {
    const merker = geraeteMerker(localStorage);

    merker.setzen();
    expect(geraeteMerker(localStorage).gesetzt()).toBe(true);

    merker.loeschen();
    expect(localStorage.getItem(ANGEMELDET_SCHLUESSEL)).toBeNull();
    expect(merker.gesetzt()).toBe(false);
  });

  it('knows of no sign-in where the storage is blocked', () => {
    const blockiert = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => undefined,
    };
    const merker = geraeteMerker(blockiert);

    merker.setzen();

    expect(merker.gesetzt()).toBe(false);
  });
});

describe('KONTO_SITZUNG', () => {
  afterEach(() => localStorage.clear());

  it('starts on the device for an Elternteil never signed in', () => {
    const sitzung = TestBed.inject(KONTO_SITZUNG);

    expect(sitzung.stand()).toEqual({ art: 'abgemeldet' });
    expect(sitzung.auswahl.teams()).toEqual([]);
  });
});
