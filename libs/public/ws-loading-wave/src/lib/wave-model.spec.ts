import {
  dotCenters,
  dotDisplacement,
  frontRadius,
  waveGeometry,
  waveIntensity,
} from './wave-model';

const sweepMs = 1600;
const geometry = waveGeometry(1000, 400, { dotSpacing: 20, sweepMs });

/** the x where the front crosses the row at `y` at the time `elapsedMs` */
function frontX(y: number, elapsedMs: number): number {
  const radius = frontRadius(geometry, elapsedMs);
  const dy = y - geometry.centerY;
  return geometry.centerX + Math.sqrt(radius * radius - dy * dy);
}

describe('wave model', () => {
  describe('waveGeometry', () => {
    it('centres the circle far left of the element, at mid-height', () => {
      expect(geometry.centerX).toBeLessThan(-1000);
      expect(geometry.centerY).toBe(200);
    });

    it('starts the front at the left edge', () => {
      expect(frontX(200, 0)).toBeCloseTo(0, 6);
    });

    it('ends the sweep once the tail left the element at every row', () => {
      const end = sweepMs - 1;
      for (const y of [0, 200, 400]) {
        expect(frontX(y, end)).toBeGreaterThan(1000 + geometry.tail * 0.95);
      }
    });
  });

  describe('waveIntensity', () => {
    const y = 200;
    const t = sweepMs / 2;
    const front = frontX(y, t);

    it('is 0 ahead of the front', () => {
      expect(waveIntensity(front + 20, y, t, geometry)).toBe(0);
      expect(waveIntensity(front + 300, y, t, geometry)).toBe(0);
    });

    it('is highest just behind the front', () => {
      const peak = waveIntensity(front - 0.01, y, t, geometry);
      expect(peak).toBeCloseTo(1, 2);
      expect(waveIntensity(front - 10, y, t, geometry)).toBeLessThan(peak);
    });

    it('falls off over about 2.5 dot spacings behind the front', () => {
      const oneSpacing = waveIntensity(front - 20, y, t, geometry);
      const fade = waveIntensity(front - 50, y, t, geometry);
      const far = waveIntensity(front - 120, y, t, geometry);
      expect(oneSpacing).toBeGreaterThan(0.3);
      expect(fade).toBeLessThan(0.15);
      expect(far).toBeLessThan(0.01);
    });

    it('lights mid-height before the edges of the same column (curved front)', () => {
      const x = frontX(200, t) - 1;
      expect(waveIntensity(x, 200, t, geometry)).toBeGreaterThan(0.9);
      expect(waveIntensity(x, 0, t, geometry)).toBe(0);
      expect(waveIntensity(x, 400, t, geometry)).toBe(0);
    });

    it('repeats every sweep', () => {
      for (const x of [100, 500, 900]) {
        expect(waveIntensity(x, y, 300, geometry)).toBeCloseTo(
          waveIntensity(x, y, 300 + sweepMs, geometry),
          9
        );
      }
    });

    it('is always between 0 and 1', () => {
      for (let x = 0; x <= 1000; x += 37) {
        for (let time = 0; time < sweepMs; time += 97) {
          const value = waveIntensity(x, y, time, geometry);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('dotDisplacement', () => {
    it('leaves dots far from the front at rest', () => {
      expect(dotDisplacement(900, 200, 0, geometry)).toEqual({ dx: 0, dy: 0 });
    });

    it('pushes lit dots away from the centre, by less than a third of a spacing', () => {
      const t = sweepMs / 2;
      const { dx, dy } = dotDisplacement(frontX(100, t) - 15, 100, t, geometry);
      expect(dx).toBeGreaterThan(0);
      // above mid-height the push points up a little
      expect(dy).toBeLessThan(0);
      expect(Math.hypot(dx, dy)).toBeLessThan(20 / 3);
    });
  });

  describe('dotCenters', () => {
    it('lays a grid centred in the spacing cells, covering the element', () => {
      const centers = dotCenters(waveGeometry(60, 40, { dotSpacing: 20 }));
      expect(centers).toEqual([
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 50, y: 10 },
        { x: 10, y: 30 },
        { x: 30, y: 30 },
        { x: 50, y: 30 },
      ]);
    });
  });
});
