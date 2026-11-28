import { CanvasWaveRenderer } from './canvas-wave-renderer';
import { FRONT_LINE_ALPHA, LIT_ALPHA, REST_ALPHA, type Rgb } from './renderer';
import { dotCenters, waveGeometry } from './wave-model';

interface Arc {
  fill: string;
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

/** a 2D context that records the dots and lines drawn */
function recordingContext() {
  const arcs: Arc[] = [];
  const strokes: number[] = [];
  const pen = { globalAlpha: 1, fillStyle: '' };
  const context = {
    get globalAlpha() {
      return pen.globalAlpha;
    },
    set globalAlpha(alpha: number) {
      pen.globalAlpha = alpha;
    },
    get fillStyle() {
      return pen.fillStyle;
    },
    set fillStyle(style: string) {
      pen.fillStyle = style;
    },
    strokeStyle: '',
    lineWidth: 1,
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(() => strokes.push(pen.globalAlpha)),
    arc: jest.fn((x: number, y: number, radius: number) =>
      arcs.push({
        fill: pen.fillStyle,
        x,
        y,
        radius,
        alpha: pen.globalAlpha,
      })
    ),
  };
  return { context, arcs, strokes };
}

function setUp(accent?: Rgb, color: Rgb = { r: 200, g: 210, b: 220 }) {
  const recording = recordingContext();
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => recording.context),
  } as unknown as HTMLCanvasElement;
  const renderer = CanvasWaveRenderer.create(canvas, { color, accent });
  if (renderer == null) {
    throw new Error('no renderer');
  }
  const geometry = waveGeometry(400, 100, {
    dotSpacing: 20,
    dotSize: 2,
    sweepMs: 1000,
  });
  renderer.resize(geometry, 2);
  return { ...recording, canvas, renderer, geometry };
}

describe('CanvasWaveRenderer', () => {
  it('is not created without a 2D context', () => {
    const canvas = {
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(
      CanvasWaveRenderer.create(canvas, { color: { r: 0, g: 0, b: 0 } })
    ).toBeNull();
  });

  it('sizes the canvas by the pixel ratio', () => {
    const { canvas } = setUp();
    expect([canvas.width, canvas.height]).toEqual([800, 200]);
  });

  it('draws one dot per grid cell at rest, all alike and without a front line', () => {
    const { renderer, arcs, strokes, geometry, context } = setUp();
    renderer.draw({ elapsedMs: 500, wave: 0, dots: 1 });
    expect(arcs).toHaveLength(dotCenters(geometry).length);
    expect(new Set(arcs.map((arc) => arc.radius))).toEqual(new Set([1]));
    expect(arcs.every((arc) => arc.alpha === REST_ALPHA)).toBe(true);
    expect(strokes).toEqual([]);
    expect(context.fillStyle).toBe('rgb(200, 210, 220)');
  });

  it('draws the dots behind the front brighter and larger, with a front line', () => {
    const { renderer, arcs, strokes, geometry } = setUp();
    renderer.draw({ elapsedMs: 500, wave: 1, dots: 1 });
    const dots = arcs.filter((arc) => arc.radius < 100);
    expect(dots).toHaveLength(dotCenters(geometry).length);
    const lit = dots.filter((arc) => arc.radius > 1);
    expect(lit.length).toBeGreaterThan(0);
    expect(Math.max(...lit.map((arc) => arc.alpha))).toBeGreaterThan(
      (REST_ALPHA + LIT_ALPHA) / 2
    );
    expect(strokes).toHaveLength(1);
  });

  it("strokes the front's whole circle, so a centred front shows all around", () => {
    const { renderer, context, canvas } = setUp();
    const centred = waveGeometry(60, 60, {
      dotSpacing: 8,
      dotSize: 2,
      sweepMs: 1000,
      origin: 'center',
    });
    renderer.resize(centred, 2);
    renderer.draw({ elapsedMs: 300, wave: 1, dots: 1 });
    expect(canvas.width).toBe(120);
    expect(context.arc).toHaveBeenLastCalledWith(
      30,
      30,
      expect.any(Number),
      0,
      2 * Math.PI
    );
  });

  it('fades the whole grid with the dots opacity', () => {
    const { renderer, arcs } = setUp();
    renderer.draw({ elapsedMs: 500, wave: 0, dots: 0.5 });
    expect(arcs[0].alpha).toBeCloseTo(REST_ALPHA / 2, 9);
  });

  it('draws nothing once the dots faded out', () => {
    const { renderer, arcs, context } = setUp();
    renderer.draw({ elapsedMs: 500, wave: 1, dots: 0 });
    expect(arcs).toEqual([]);
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 200);
  });

  it('draws nothing after dispose', () => {
    const { renderer, arcs } = setUp();
    renderer.dispose();
    renderer.draw({ elapsedMs: 500, wave: 1, dots: 1 });
    expect(arcs).toEqual([]);
  });

  it("multiplies the colour's own alpha into the dots", () => {
    const { renderer, arcs } = setUp();
    renderer.setLook({ color: { r: 1, g: 2, b: 3, alpha: 0.5 } });
    renderer.draw({ elapsedMs: 500, wave: 0, dots: 1 });
    expect(arcs[0].alpha).toBeCloseTo(REST_ALPHA / 2, 9);
  });

  it('draws nothing in a transparent colour', () => {
    const { renderer, arcs } = setUp();
    renderer.setLook({ color: { r: 0, g: 0, b: 0, alpha: 0 } });
    renderer.draw({ elapsedMs: 500, wave: 1, dots: 1 });
    expect(arcs).toEqual([]);
  });

  describe('accent colour', () => {
    const accent = { r: 0, g: 100, b: 0 };

    it('draws every dot in the dots colour without one', () => {
      const { renderer, arcs, geometry } = setUp();
      renderer.draw({ elapsedMs: geometry.sweepMs / 2, wave: 1, dots: 1 });
      expect(new Set(arcs.map((arc) => arc.fill))).toEqual(
        new Set(['rgb(200, 210, 220)'])
      );
    });

    it('mixes lit dots towards it by their light, resting dots keep the colour', () => {
      const { renderer, arcs, geometry } = setUp(accent);
      renderer.draw({ elapsedMs: geometry.sweepMs / 2, wave: 1, dots: 1 });
      const brightest = arcs.reduce((a, b) => (b.alpha > a.alpha ? b : a));
      const resting = arcs.find((arc) => arc.fill === 'rgb(200, 210, 220)');
      expect(resting).toBeDefined();
      expect(brightest.fill).not.toBe('rgb(200, 210, 220)');
      const [r] = brightest.fill.match(/\d+/g)?.map(Number) ?? [];
      // more than halfway from 200 to the accent's 0
      expect(r).toBeLessThan(100);
    });

    it("takes the accent's own opacity for lit dots and the front line", () => {
      const faint = { r: 200, g: 210, b: 220, alpha: 0.2 };
      const plain = setUp(undefined, faint);
      const accented = setUp({ ...accent, alpha: 1 }, faint);
      for (const { renderer, geometry } of [plain, accented]) {
        renderer.draw({ elapsedMs: geometry.sweepMs / 2, wave: 1, dots: 1 });
      }
      const brightest = (arcs: { alpha: number }[]) =>
        Math.max(...arcs.map((arc) => arc.alpha));
      expect(brightest(plain.arcs)).toBeLessThan(0.2 * LIT_ALPHA + 1e-9);
      expect(brightest(accented.arcs)).toBeGreaterThan(0.5 * LIT_ALPHA);
      // resting dots keep the colour's own opacity
      expect(Math.min(...accented.arcs.map((arc) => arc.alpha))).toBeCloseTo(
        0.2 * REST_ALPHA,
        9
      );
      expect(plain.strokes).toEqual([0.2 * FRONT_LINE_ALPHA]);
      expect(accented.strokes).toEqual([FRONT_LINE_ALPHA]);
    });

    it('strokes the front line in the accent colour', () => {
      const { renderer, context, geometry } = setUp(accent);
      renderer.draw({ elapsedMs: geometry.sweepMs / 2, wave: 1, dots: 1 });
      expect(context.strokeStyle).toBe('rgb(0, 100, 0)');
    });
  });
});
