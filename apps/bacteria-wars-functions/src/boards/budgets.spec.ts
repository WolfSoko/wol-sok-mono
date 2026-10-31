import { expectedRerunMs, MAX_VERIFIED_TICKS } from './budgets';

describe('expectedRerunMs', () => {
  it('costs 10 ms a tick on the base arena at simulation resolution "Normal"', () => {
    expect(expectedRerunMs(MAX_VERIFIED_TICKS)).toBe(360_000);
    expect(expectedRerunMs(MAX_VERIFIED_TICKS, 320 * 180)).toBe(360_000);
  });

  it('grows with the cells of the arena: a finer grid or a bigger map', () => {
    expect(expectedRerunMs(3_600, 640 * 360)).toBe(4 * 36_000);
    expect(expectedRerunMs(3_600, 256 * 144)).toBeCloseTo(0.64 * 36_000);
  });
});
