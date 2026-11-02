import { frameFade } from './frame-rate';

describe('frameFade', () => {
  it('should fade two 120 Hz frames as much as one 60 Hz frame', () => {
    expect(frameFade(0.8, 1 / 120) ** 2).toBeCloseTo(frameFade(0.8, 1 / 60));
  });

  it('should fade out completely past the end of the animation', () => {
    // 1 - animationT^15 is below 0 once animationT passes 1
    expect(frameFade(1 - 1.02 ** 15, 1 / 60)).toBe(0);
  });
});
