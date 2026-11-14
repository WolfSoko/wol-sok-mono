import { germanDays } from './german-days';

describe('germanDays', () => {
  it('says one day as "einen Tag"', () => {
    expect(germanDays(1)).toBe('einen Tag');
    expect(germanDays(1, { further: true })).toBe('einen weiteren Tag');
  });

  it('says more days with their number', () => {
    expect(germanDays(7)).toBe('7 Tage');
    expect(germanDays(2, { further: true })).toBe('2 weitere Tage');
  });
});
