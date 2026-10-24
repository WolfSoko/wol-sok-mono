import { percentages } from './percentages';

describe('percentages', () => {
  it('is all zero without votes', () => {
    expect(percentages([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('adds up to 100 where plain rounding gives 99', () => {
    // Math.round gives 33 + 33 + 33
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
  });

  it('adds up to 100 where plain rounding gives 101', () => {
    // Math.round gives 50 + 17 + 17 + 17
    expect(percentages([3, 1, 1, 1])).toEqual([50, 17, 17, 16]);
  });

  it('gives the rounding point to the largest remainder', () => {
    // 2/7 = 28.57, 2/7 = 28.57, 3/7 = 42.86 -> floors 28 + 28 + 42 = 98
    expect(percentages([2, 2, 3])).toEqual([29, 28, 43]);
  });

  it('keeps exact shares', () => {
    expect(percentages([1, 3])).toEqual([25, 75]);
    expect(percentages([0, 5])).toEqual([0, 100]);
  });

  it('always sums to 100', () => {
    for (let i = 0; i < 200; i++) {
      const counts = Array.from(
        { length: 2 + (i % 9) },
        (_, j) => (i * 7 + j * 13) % 11
      );
      const sum = percentages(counts).reduce((a, b) => a + b, 0);
      expect(sum).toBe(counts.some((c) => c > 0) ? 100 : 0);
    }
  });
});
