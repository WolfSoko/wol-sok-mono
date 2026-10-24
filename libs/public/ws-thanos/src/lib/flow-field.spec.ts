import { FlowField } from './flow-field';
import { SimplexNoise } from './simplex-noise';
import { FLOW_FIELD } from './vaporizing-front';
import { windOf } from './wind';

describe('FlowField', () => {
  const noise = new SimplexNoise({ random: () => 0.3 });
  const seed = 7;
  const field = new FlowField(100, 60, seed, windOf(), 10, noise);
  const out = new Float32Array(2);

  /** the push of the default wind: noise mapped to [0, 1], to the right and up */
  function expected(x: number, y: number): [number, number] {
    const { frequency: f, xSeedOffset, ySeedDivisor } = FLOW_FIELD;
    return [
      noise.raw3D(x * f, y * f, (seed + xSeedOffset) * f) * 0.5 + 0.5,
      -(noise.raw3D(x * f, (seed / ySeedDivisor) * f, y * f) * 0.5 + 0.5),
    ];
  }

  it('should return the noise at the grid points', () => {
    field.sample(30, 20, out);
    const [x, y] = expected(30, 20);
    expect(out[0]).toBeCloseTo(x, 5);
    expect(out[1]).toBeCloseTo(y, 5);
  });

  it('should stay close to the noise between the grid points', () => {
    for (const [x, y] of [
      [3, 4],
      [55.5, 31.2],
      [99, 59],
    ]) {
      field.sample(x, y, out);
      const [nx, ny] = expected(x, y);
      expect(Math.abs(out[0] - nx)).toBeLessThan(0.02);
      expect(Math.abs(out[1] - ny)).toBeLessThan(0.02);
    }
  });

  it('should turn the push into the wind', () => {
    // to the bottom left, the opposite of the default wind
    const opposite = new FlowField(100, 60, seed, windOf(225), 10, noise);
    opposite.sample(30, 20, out);
    const [x, y] = expected(30, 20);
    expect(out[0]).toBeCloseTo(-x, 5);
    expect(out[1]).toBeCloseTo(-y, 5);
  });

  it('should clamp positions outside of the canvas', () => {
    field.sample(-50, 500, out);
    const inside = new Float32Array(2);
    field.sample(0, 60, inside);
    expect(Array.from(out)).toEqual(Array.from(inside));
  });
});
