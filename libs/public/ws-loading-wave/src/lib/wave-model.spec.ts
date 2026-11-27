import {
  AFTERGLOW,
  DEFAULT_FRONT_ROUNDNESS,
  MAX_DOTS,
  dotCenters,
  dotDisplacement,
  frontRadius,
  waveGeometry,
  waveIntensity,
} from './wave-model';

const sweepMs = 1600;
const geometry = waveGeometry(1000, 400, { dotSpacing: 20, sweepMs });
/** a time in the second sweep, when the first one left its afterglow */
const secondSweep = (ms: number): number => sweepMs + ms;

/** the x where the front crosses the row at `y` at the time `elapsedMs` */
function frontX(y: number, elapsedMs: number): number {
  const radius = frontRadius(geometry, elapsedMs);
  const dy = y - geometry.centerY;
  return geometry.centerX + Math.sqrt(radius * radius - dy * dy);
}

describe('wave model', () => {
  describe('waveGeometry', () => {
    it('centres the circle left of the element, at mid-height', () => {
      expect(geometry.centerX).toBeLessThan(0);
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

  describe('frontRoundness', () => {
    /** how much later the front reaches the top row than mid-height, in ms */
    function edgeLagMs(frontRoundness: number, width = 1000): number {
      const round = waveGeometry(width, 400, {
        dotSpacing: 20,
        sweepMs,
        frontRoundness,
      });
      const reach = (y: number): number =>
        Math.hypot(0 - round.centerX, y - round.centerY) - round.startRadius;
      return (reach(0) / round.travel) * sweepMs;
    }

    /** the lag of the front's ends at phase 0, in CSS pixels */
    function edgeLagPx(frontRoundness: number, width = 1000): number {
      const round = waveGeometry(width, 400, {
        dotSpacing: 20,
        sweepMs,
        frontRoundness,
      });
      const dy = 0 - round.centerY;
      return 0 - (round.centerX + Math.sqrt(round.startRadius ** 2 - dy * dy));
    }

    it('lights the top and the middle of a column at nearly the same time at 0', () => {
      expect(edgeLagMs(0)).toBeLessThan(1);
      expect(edgeLagPx(0)).toBeLessThan(0.5);
    });

    it('lags the ends by half the height at 1 (a half circle)', () => {
      expect(edgeLagPx(1)).toBeCloseTo(200, 6);
    });

    it('lags the ends by its share of half the height in between', () => {
      expect(edgeLagPx(0.5)).toBeCloseTo(100, 6);
      expect(edgeLagPx(0.25)).toBeCloseTo(50, 6);
    });

    it('caps the lag by the width on a narrow host', () => {
      expect(edgeLagPx(1, 150)).toBeCloseTo(150, 6);
    });

    it('is 0.5 when unset', () => {
      const unset = waveGeometry(1000, 400, { dotSpacing: 20, sweepMs });
      expect(unset).toEqual(
        waveGeometry(1000, 400, {
          dotSpacing: 20,
          sweepMs,
          frontRoundness: DEFAULT_FRONT_ROUNDNESS,
        })
      );
      expect(DEFAULT_FRONT_ROUNDNESS).toBe(0.5);
    });

    for (const frontRoundness of [0, 0.3, 1]) {
      it(`starts at the left edge and passes every row at ${frontRoundness}`, () => {
        const round = waveGeometry(1000, 400, {
          dotSpacing: 20,
          sweepMs,
          frontRoundness,
        });
        const x = (y: number, elapsedMs: number): number => {
          const radius = frontRadius(round, elapsedMs);
          const dy = y - round.centerY;
          return round.centerX + Math.sqrt(radius * radius - dy * dy);
        };
        expect(x(200, 0)).toBeCloseTo(0, 6);
        for (const y of [0, 200, 400]) {
          expect(x(y, sweepMs - 1)).toBeGreaterThan(1000 + round.tail * 0.9);
        }
      });
    }
  });

  describe('waveIntensity', () => {
    const y = 200;
    const t = sweepMs / 2;
    const front = frontX(y, t);

    it('lights nothing ahead of the front on the first sweep', () => {
      for (const x of [front + 20, front + 300, 990]) {
        expect(waveIntensity(x, y, t, geometry)).toBe(0);
      }
    });

    it('shows ahead of the front only the fading afterglow of the last sweep', () => {
      const later = secondSweep(t);
      const justAhead = waveIntensity(front + 20, y, later, geometry);
      const farAhead = waveIntensity(front + 300, y, later, geometry);
      expect(justAhead).toBeLessThan(0.01);
      expect(farAhead).toBeGreaterThan(justAhead);
      expect(farAhead).toBeLessThan(AFTERGLOW);
    });

    it('is highest just behind the front', () => {
      const peak = waveIntensity(front - 0.01, y, t, geometry);
      expect(peak).toBeCloseTo(1, 2);
      expect(waveIntensity(front - 10, y, t, geometry)).toBeLessThan(peak);
    });

    it('dims to the afterglow within about 2.5 dot spacings behind the front', () => {
      expect(waveIntensity(front - 20, y, t, geometry)).toBeGreaterThan(
        AFTERGLOW + 0.03
      );
      expect(waveIntensity(front - 50, y, t, geometry)).toBeCloseTo(
        AFTERGLOW,
        2
      );
      expect(waveIntensity(front - 300, y, t, geometry)).toBe(AFTERGLOW);
    });

    it('lets the afterglow fade in the second half of the sweep', () => {
      const late = sweepMs * 0.95;
      const leftEdge = waveIntensity(10, y, late, geometry);
      expect(leftEdge).toBeLessThan(AFTERGLOW / 2);
      expect(leftEdge).toBeGreaterThan(0);
    });

    it('lights mid-height before the edges of the same column (curved front)', () => {
      const x = frontX(200, t) - 1;
      expect(waveIntensity(x, 200, t, geometry)).toBeGreaterThan(0.9);
      expect(waveIntensity(x, 0, t, geometry)).toBeLessThan(0.01);
      expect(waveIntensity(x, 400, t, geometry)).toBeLessThan(0.01);
    });

    it('repeats every sweep after the first', () => {
      for (const x of [100, 500, 900]) {
        expect(waveIntensity(x, y, secondSweep(300), geometry)).toBeCloseTo(
          waveIntensity(x, y, secondSweep(300) + sweepMs, geometry),
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

  describe('dot count', () => {
    it('widens a tiny spacing so the grid holds at most MAX_DOTS dots', () => {
      const tiny = waveGeometry(1000, 400, { dotSpacing: 0.1, sweepMs });
      expect(dotCenters(tiny).length).toBeLessThanOrEqual(MAX_DOTS);
      expect(tiny.dotSpacing).toBeGreaterThan(0.1);
    });

    it('counts the rows and columns as rounded, not just the area', () => {
      const narrow = waveGeometry(100, 140, { dotSpacing: 0.1, sweepMs });
      expect(dotCenters(narrow).length).toBeLessThanOrEqual(MAX_DOTS);
    });

    it('lays no dots on an empty host, without looping over its rows', () => {
      const empty = waveGeometry(0, 400, { dotSpacing: 0.000001, sweepMs });
      expect(dotCenters(empty)).toEqual([]);
    });

    it('keeps the asked spacing below the limit', () => {
      expect(
        waveGeometry(1000, 400, { dotSpacing: 20, sweepMs }).dotSpacing
      ).toBe(20);
    });
  });

  describe('dotCenters', () => {
    it('lays a grid centred in the spacing cells, covering the element', () => {
      const centers = dotCenters(
        waveGeometry(60, 40, { dotSpacing: 20, sweepMs })
      );
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
