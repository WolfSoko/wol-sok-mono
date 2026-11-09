import { TestBed } from '@angular/core/testing';
import { AUSWAHL } from './auswahl';
import { AUSWAHL_SCHLUESSEL } from '@wolsok/feat-korbjaeger-auswahl';

describe('AUSWAHL', () => {
  afterEach(() => localStorage.clear());

  it("keeps Meine Teams in the device's storage, across a reload", async () => {
    await TestBed.inject(AUSWAHL).folgen(313036);

    TestBed.resetTestingModule();

    expect(TestBed.inject(AUSWAHL).teams()).toEqual([313036]);
  });

  it('shows what another tab followed', () => {
    const auswahl = TestBed.inject(AUSWAHL);

    localStorage.setItem(
      AUSWAHL_SCHLUESSEL,
      JSON.stringify({ version: 1, teams: [201500] })
    );
    window.dispatchEvent(
      new StorageEvent('storage', { key: AUSWAHL_SCHLUESSEL })
    );

    expect(auswahl.teams()).toEqual([201500]);
  });
});
