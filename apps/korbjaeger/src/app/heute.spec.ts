import { datumInDeutschland } from './heute';

describe('datumInDeutschland', () => {
  it.each([
    ['2026-11-08T12:00:00Z', '2026-11-08'],
    // after midnight in Germany, still the day before in UTC
    ['2026-11-08T23:30:00Z', '2026-11-09'],
    ['2026-07-31T22:30:00Z', '2026-08-01'],
    ['2026-11-08T22:59:00Z', '2026-11-08'],
  ])('dates %s as the DBB does: %s', (moment, datum) => {
    expect(datumInDeutschland(new Date(moment))).toBe(datum);
  });
});
