import { frontGeometry } from './vaporizing-front';
import { effectMargins, effectScale, windOf } from './wind';

describe('windOf', () => {
  it('should not rotate the default wind to the top right', () => {
    const wind = windOf();
    expect(wind.cos).toBe(1);
    expect(wind.sin).toBe(0);
    expect(wind.x).toBeCloseTo(Math.SQRT1_2);
    expect(wind.y).toBeCloseTo(-Math.SQRT1_2);
  });

  it('should take css gradient angles, clockwise from up', () => {
    const toRight = windOf(90);
    expect(toRight.x).toBeCloseTo(1);
    expect(toRight.y).toBeCloseTo(0);
    const down = windOf(180);
    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeCloseTo(1);
  });

  it('should rotate the default wind onto the direction', () => {
    const { cos, sin, x, y } = windOf(200);
    // the default wind to the top right, rotated
    const rotatedX = cos * Math.SQRT1_2 - sin * -Math.SQRT1_2;
    const rotatedY = sin * Math.SQRT1_2 + cos * -Math.SQRT1_2;
    expect(rotatedX).toBeCloseTo(x);
    expect(rotatedY).toBeCloseTo(y);
  });

  it('should blow the default way for a direction that is no number', () => {
    expect(windOf(NaN)).toEqual(windOf());
  });
});

describe('effectMargins', () => {
  it('should keep the room of the default wind: one width right, four heights up', () => {
    expect(effectMargins()).toEqual({ left: 0, right: 1, top: 4, bottom: 0 });
    expect(effectScale(effectMargins())).toEqual({ width: 2, height: 5 });
  });

  it('should make room where the dust blows', () => {
    const left = effectMargins(270);
    expect(left.left).toBe(1);
    expect(left.right).toBe(0);
    // the dust spreads up and down a bit
    expect(left.top).toBeGreaterThan(0);
    expect(left.bottom).toBeCloseTo(left.top);

    expect(effectMargins(225)).toEqual({
      left: 1,
      right: 0,
      top: 0,
      bottom: 4,
    });
  });

  it('should treat a full turn like no turn', () => {
    expect(effectMargins(45 + 360)).toEqual(effectMargins(45));
    expect(effectMargins(45 - 360)).toEqual(effectMargins(45));
  });
});

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
