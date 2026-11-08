import { TestBed } from '@angular/core/testing';
import { datumInDeutschland, HEUTE, msBisMorgen } from './heute';

const MINUTE = 60_000;
const STUNDE = 60 * MINUTE;

describe('datumInDeutschland', () => {
  it.each([
    ['2026-11-08T12:00:00Z', '2026-11-08'],
    // after midnight in Germany, still the day before in UTC
    ['2026-11-08T23:30:00Z', '2026-11-09'],
    ['2026-07-31T22:30:00Z', '2026-08-01'],
    ['2026-11-08T22:59:00Z', '2026-11-08'],
    ['2027-01-05T08:00:00Z', '2027-01-05'],
  ])('dates %s as the DBB does: %s', (moment, datum) => {
    expect(datumInDeutschland(new Date(moment))).toBe(datum);
  });
});

describe('msBisMorgen', () => {
  it.each([
    ['in winter', '2026-11-08T22:30:00Z', 30 * MINUTE],
    ['in summer', '2026-07-31T21:00:00Z', STUNDE],
    ['just after midnight', '2026-11-08T23:00:00Z', 24 * STUNDE],
    // the day the clocks go forward has 23 hours, the day they go back 25
    ['on the day summer time starts', '2026-03-28T23:30:00Z', 22.5 * STUNDE],
    ['on the day summer time ends', '2026-10-24T22:30:00Z', 24.5 * STUNDE],
  ])('waits until the next German midnight %s', (_case, moment, ms) => {
    expect(msBisMorgen(new Date(moment))).toBe(ms);
  });
});

describe('HEUTE', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 23:30 in Germany
    vi.setSystemTime(new Date('2026-11-08T22:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('turns to the next day at German midnight, day after day', () => {
    const heute = TestBed.inject(HEUTE);
    expect(heute()).toBe('2026-11-08');

    vi.advanceTimersByTime(30 * MINUTE - 1);
    expect(heute()).toBe('2026-11-08');

    vi.advanceTimersByTime(1);
    expect(heute()).toBe('2026-11-09');

    vi.advanceTimersByTime(24 * STUNDE);
    expect(heute()).toBe('2026-11-10');
  });

  it('keeps a single timer and clears it with the app', () => {
    TestBed.inject(HEUTE);
    expect(vi.getTimerCount()).toBe(1);

    TestBed.resetTestingModule();

    expect(vi.getTimerCount()).toBe(0);
  });
});
