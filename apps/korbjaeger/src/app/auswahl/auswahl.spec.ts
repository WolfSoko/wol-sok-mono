import { TestBed } from '@angular/core/testing';
import { AUSWAHL } from './auswahl';

describe('AUSWAHL', () => {
  afterEach(() => localStorage.clear());

  it("keeps Meine Teams in the device's storage, across a reload", async () => {
    await TestBed.inject(AUSWAHL).folgen(313036);

    TestBed.resetTestingModule();

    expect(TestBed.inject(AUSWAHL).teams()).toEqual([313036]);
  });
});
