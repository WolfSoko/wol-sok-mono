import { FRACTAL_PRESETS } from './fractal-presets';
import { MANDELBROT_FRAGMENT_SHADER } from './mandelbrot-shader';
import {
  FractalView,
  HOME_VIEW,
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  MAX_SCALE,
  MIN_SCALE,
  autoIterations,
  clampScale,
  formatComplex,
  formatMagnification,
  magnification,
  needsHighPrecision,
  panByPixels,
  planFlight,
  sampleFlight,
  screenToComplex,
  splitFloat,
  zoomAt,
} from './fractal-view';

describe('splitFloat', () => {
  it('reproduces the value from the high/low pair', () => {
    const value = -0.7746806106269039;
    const [high, low] = splitFloat(value);

    expect(high).toBe(Math.fround(value));
    expect(high + low).toBeCloseTo(value, 12);
  });

  it('carries more precision than a single float', () => {
    const value = -0.7746806106269039;
    const [high, low] = splitFloat(value);

    expect(Math.abs(high + low - value)).toBeLessThan(
      Math.abs(Math.fround(value) - value)
    );
  });

  it('keeps the low part at zero for exactly representable values', () => {
    expect(splitFloat(0.5)).toEqual([0.5, 0]);
  });
});

describe('clampScale', () => {
  it('keeps the scale inside the renderable range', () => {
    expect(clampScale(1e-30)).toBe(MIN_SCALE);
    expect(clampScale(1000)).toBe(MAX_SCALE);
    expect(clampScale(0.5)).toBe(0.5);
  });
});

function complexToScreen(
  view: FractalView,
  point: { x: number; y: number },
  width: number,
  height: number
): { x: number; y: number } {
  const aspect = width / height;
  return {
    x: ((point.x - view.centerX) / (2 * aspect * view.scale) + 0.5) * width,
    y: (0.5 - (point.y - view.centerY) / (2 * view.scale)) * height,
  };
}

describe('zoomAt', () => {
  const view: FractalView = { centerX: -0.5, centerY: 0.25, scale: 1 };

  it('keeps the anchor point fixed on screen', () => {
    const anchor = { x: 0.1, y: -0.2 };
    const zoomed = zoomAt(view, 0.25, anchor);

    const before = complexToScreen(view, anchor, 400, 200);
    const after = complexToScreen(zoomed, anchor, 400, 200);

    expect(zoomed.scale).toBeCloseTo(0.25, 12);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });

  it('does not drift the anchor when the zoom hits the limit', () => {
    const deep: FractalView = { centerX: 0, centerY: 0, scale: MIN_SCALE };
    const zoomed = zoomAt(deep, 0.01, { x: 1, y: 1 });

    expect(zoomed.scale).toBe(MIN_SCALE);
    expect(zoomed.centerX).toBe(0);
    expect(zoomed.centerY).toBe(0);
  });
});

describe('screenToComplex', () => {
  it('maps the canvas centre to the view centre', () => {
    const point = screenToComplex(HOME_VIEW, 200, 100, 400, 200);

    expect(point.x).toBeCloseTo(HOME_VIEW.centerX, 12);
    expect(point.y).toBeCloseTo(HOME_VIEW.centerY, 12);
  });

  it('respects the aspect ratio and the flipped screen y axis', () => {
    const view: FractalView = { centerX: 0, centerY: 0, scale: 1 };

    expect(screenToComplex(view, 400, 100, 400, 200).x).toBeCloseTo(2, 12);
    expect(screenToComplex(view, 200, 0, 400, 200).y).toBeCloseTo(1, 12);
    expect(screenToComplex(view, 200, 200, 400, 200).y).toBeCloseTo(-1, 12);
  });
});

describe('panByPixels', () => {
  it('moves the view against the drag direction', () => {
    const view: FractalView = { centerX: 0, centerY: 0, scale: 1 };
    const panned = panByPixels(view, 100, 50, 200);

    expect(panned.centerX).toBeCloseTo(-1, 12);
    expect(panned.centerY).toBeCloseTo(0.5, 12);
    expect(panned.scale).toBe(view.scale);
  });

  it('keeps the grabbed point under the cursor', () => {
    const view: FractalView = { centerX: -0.5, centerY: 0, scale: 0.4 };
    const grabbed = screenToComplex(view, 120, 40, 400, 200);
    const panned = panByPixels(view, 60, -25, 200);
    const afterDrag = screenToComplex(panned, 180, 15, 400, 200);

    expect(afterDrag.x).toBeCloseTo(grabbed.x, 12);
    expect(afterDrag.y).toBeCloseTo(grabbed.y, 12);
  });
});

describe('autoIterations', () => {
  it('grows with the zoom depth and stays inside the budget', () => {
    const shallow = autoIterations(HOME_VIEW.scale);
    const deep = autoIterations(1e-9);

    expect(deep).toBeGreaterThan(shallow);
    expect(autoIterations(MIN_SCALE)).toBeLessThanOrEqual(MAX_ITERATIONS);
  });

  it('never returns more iterations than the shader can run', () => {
    for (const scale of [4, 1, 1e-3, 1e-8, 1e-13]) {
      expect(autoIterations(scale)).toBeLessThanOrEqual(MAX_ITERATIONS);
    }
  });
});

describe('precision budget', () => {
  /**
   * Measured resolution of the shader's double-single arithmetic around the
   * interesting part of the plane: below roughly this spacing neighbouring
   * pixels collapse onto the same complex coordinate.
   */
  const EMULATED_DOUBLE_RESOLUTION = 3e-16;

  it('keeps the per-pixel spacing representable at the deepest view', () => {
    for (const canvasHeight of [720, 1440, 2160]) {
      const perPixel = (2 * MIN_SCALE) / canvasHeight;

      expect(perPixel).toBeGreaterThan(EMULATED_DOUBLE_RESOLUTION * 3);
    }
  });

  it('never asks the shader for more iterations than its loop runs', () => {
    const maxSteps = Number(
      /#define MAX_STEPS (\d+)/.exec(MANDELBROT_FRAGMENT_SHADER)?.[1]
    );

    expect(maxSteps).toBeGreaterThan(0);
    expect(MAX_ITERATIONS).toBeLessThanOrEqual(maxSteps);
    expect(MIN_ITERATIONS).toBeLessThan(MAX_ITERATIONS);
  });

  it('gives the deepest reachable view a budget that resolves it', () => {
    // A linear ramp starves views past ~10^11 and paints them as flat blobs.
    expect(autoIterations(MIN_SCALE)).toBeGreaterThan(3000);
  });
});

describe('needsHighPrecision', () => {
  it('switches to emulated doubles before single precision breaks down', () => {
    expect(needsHighPrecision(HOME_VIEW.scale)).toBe(false);
    expect(needsHighPrecision(1e-8)).toBe(true);
  });
});

describe('planFlight / sampleFlight', () => {
  const from = HOME_VIEW;
  const to: FractalView = {
    centerX: -0.7746806106269039,
    centerY: -0.1374168856037867,
    scale: 5e-10,
  };

  it('starts at the current view and lands exactly on the target', () => {
    const plan = planFlight(from, to);

    const start = sampleFlight(plan, 0);
    expect(start.centerX).toBeCloseTo(from.centerX, 12);
    expect(start.scale).toBeCloseTo(from.scale, 12);

    const end = sampleFlight(plan, 1);
    expect(end.centerX).toBeCloseTo(to.centerX, 12);
    expect(end.centerY).toBeCloseTo(to.centerY, 12);
    expect(end.scale / to.scale).toBeCloseTo(1, 6);
  });

  it('pulls back far enough to keep the target on screen while panning', () => {
    const plan = planFlight(from, to);
    const distance = Math.hypot(
      to.centerX - from.centerX,
      to.centerY - from.centerY
    );

    expect(plan.bridgeScale).toBeGreaterThanOrEqual(distance * 0.75);

    for (let step = 0; step <= 20; step++) {
      const sample = sampleFlight(plan, step / 20);
      const offset = Math.hypot(
        sample.centerX - to.centerX,
        sample.centerY - to.centerY
      );
      // The target is either on screen or the camera has not started panning.
      expect(
        offset <= sample.scale * 4 || sample.centerX === from.centerX
      ).toBe(true);
    }
  });

  it('clamps the progress outside of [0, 1]', () => {
    const plan = planFlight(from, to);

    expect(sampleFlight(plan, -1)).toEqual(sampleFlight(plan, 0));
    expect(sampleFlight(plan, 5)).toEqual(sampleFlight(plan, 1));
  });

  it('handles a pure zoom without panning', () => {
    const plan = planFlight(from, { ...from, scale: from.scale / 100 });
    const middle = sampleFlight(plan, 0.5);

    expect(middle.centerX).toBeCloseTo(from.centerX, 12);
    expect(middle.scale).toBeLessThan(from.scale);
  });
});

describe('formatting', () => {
  it('formats the magnification with a unit suffix', () => {
    expect(formatMagnification(1)).toBe('1.00');
    expect(formatMagnification(1250)).toBe('1.25 K');
    expect(formatMagnification(2.5e9)).toBe('2.50 G');
    expect(formatMagnification(0.2)).toBe('1');
  });

  it('shows more digits the deeper the zoom', () => {
    const shallow = formatComplex(-0.5, 0.25, 1);
    const deep = formatComplex(-0.5, 0.25, 1e-9);

    expect(deep.length).toBeGreaterThan(shallow.length);
    expect(formatComplex(-0.5, -0.25, 1)).toContain('-');
  });

  it('reports the magnification of the home view as one', () => {
    expect(magnification(HOME_VIEW)).toBe(1);
  });
});

describe('fractal presets', () => {
  it('has unique ids and renderable views', () => {
    const ids = new Set(FRACTAL_PRESETS.map((preset) => preset.id));

    expect(ids.size).toBe(FRACTAL_PRESETS.length);
    for (const preset of FRACTAL_PRESETS) {
      expect(clampScale(preset.view.scale)).toBe(preset.view.scale);
    }
  });

  it('ships a julia constant for every morphed preset', () => {
    for (const preset of FRACTAL_PRESETS) {
      if (preset.morph) {
        expect(preset.juliaC).toBeDefined();
      }
    }
  });
});
