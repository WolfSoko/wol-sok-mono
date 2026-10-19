import {
  addSeriesMatch,
  isHeadStart,
  isSeriesLength,
  newSeries,
  seriesWinner,
  startScales,
  winsNeeded,
} from './rivalry';

describe('series', () => {
  it('is taken by the majority of its matches', () => {
    expect(winsNeeded(1)).toBe(1);
    expect(winsNeeded(3)).toBe(2);
    expect(winsNeeded(5)).toBe(3);
  });

  it('counts the wins of each seat until one takes it', () => {
    let series = newSeries(3);
    series = addSeriesMatch(series, 0);
    expect(seriesWinner(series)).toBeNull();
    series = addSeriesMatch(series, 1);
    series = addSeriesMatch(series, null);
    expect(series.wins).toEqual([1, 1]);
    series = addSeriesMatch(series, 1);

    expect(series.wins).toEqual([1, 2]);
    expect(seriesWinner(series)).toBe(1);
  });

  it('knows its lengths', () => {
    expect(isSeriesLength(3)).toBe(true);
    expect(isSeriesLength(4)).toBe(false);
  });
});

describe('head start', () => {
  it('shrinks the colony of the seat without it', () => {
    expect(startScales(0)).toEqual([1, 1]);
    expect(startScales(-2)).toEqual([1, 0.7]);
    expect(startScales(1)).toEqual([0.85, 1]);
    expect(isHeadStart(2)).toBe(true);
    expect(isHeadStart(3)).toBe(false);
  });
});
