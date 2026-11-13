import { TestBed } from '@angular/core/testing';
import { SELECTION } from './selection';
import { SELECTION_KEY } from '@wolsok/feat-korbjaeger-selection';

describe('AUSWAHL', () => {
  afterEach(() => localStorage.clear());

  it("keeps Meine Teams in the device's storage, across a reload", async () => {
    await TestBed.inject(SELECTION).follow(313036);

    TestBed.resetTestingModule();

    expect(TestBed.inject(SELECTION).teams()).toEqual([313036]);
  });

  it('shows what another tab followed', () => {
    const selection = TestBed.inject(SELECTION);

    localStorage.setItem(
      SELECTION_KEY,
      JSON.stringify({ version: 3, teams: { 201500: 1 } })
    );
    window.dispatchEvent(new StorageEvent('storage', { key: SELECTION_KEY }));

    expect(selection.teams()).toEqual([201500]);
  });
});
