import { frontGeometry, vaporizingFront } from './vaporizing-front';
import { windOf } from './wind';

describe('frontGeometry', () => {
  const bounds = { left: 0, top: 40, right: 9, bottom: 49 };

  it('should end the front at the bottom left for the default wind', () => {
    const front = frontGeometry(bounds, windOf(), { top: 40, bottom: 0 });
    expect(front.originX).toBeCloseTo(0);
    expect(front.originY).toBeCloseTo(49);
    // starts as far out as the room above the element
    expect(front.reach).toBeCloseTo(Math.hypot(9, 9 + 40));
  });

  it('should end the front on the upwind side', () => {
    const front = frontGeometry(bounds, windOf(270), { top: 10, bottom: 10 });
    // blowing to the left, the front sweeps from left to right
    expect(front.originX).toBeCloseTo(9);
    expect(front.originY).toBeCloseTo(44.5);
  });
});

describe('vaporizingFront', () => {
  const geometry = { originX: 0, originY: 49, reach: 50 };

  it('should start the front at its reach and shrink it', () => {
    expect(vaporizingFront(0, geometry).radiusPow).toBe(50 * 50);
    expect(vaporizingFront(0.3, geometry).radiusPow).toBeLessThan(50 * 50);
  });
});
