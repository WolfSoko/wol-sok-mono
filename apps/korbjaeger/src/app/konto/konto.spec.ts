import { TestBed } from '@angular/core/testing';
import { BLOCKED_STORAGE } from '../../testing/storage';
import { SIGNED_IN_KEY, geraeteMerker, KONTO_SITZUNG } from './konto';

describe('geraeteMerker', () => {
  afterEach(() => localStorage.clear());

  it("remembers the sign-in in the device's storage", () => {
    const merker = geraeteMerker(localStorage);

    merker.setzen();
    expect(geraeteMerker(localStorage).gesetzt()).toBe(true);

    merker.loeschen();
    expect(localStorage.getItem(SIGNED_IN_KEY)).toBeNull();
    expect(merker.gesetzt()).toBe(false);
  });

  it("hears of another tab's sign-in or sign-out, and of nothing else", () => {
    const fenster = new EventTarget();
    let gehoert = 0;
    geraeteMerker(localStorage, fenster).beobachten(() => gehoert++);

    fenster.dispatchEvent(new StorageEvent('storage', { key: SIGNED_IN_KEY }));
    fenster.dispatchEvent(new StorageEvent('storage', { key: 'anderes' }));
    fenster.dispatchEvent(new StorageEvent('storage', { key: null }));

    expect(gehoert).toBe(2);
  });

  it('knows of no sign-in where the storage is blocked', () => {
    const merker = geraeteMerker(BLOCKED_STORAGE);

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
