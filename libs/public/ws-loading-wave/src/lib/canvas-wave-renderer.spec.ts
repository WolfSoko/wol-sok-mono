import { CanvasWaveRenderer } from './canvas-wave-renderer';
import { LIT_ALPHA, REST_ALPHA } from './renderer';
import { dotCenters, waveGeometry } from './wave-model';

interface Arc {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

/** a 2D context that records the dots and lines drawn */
function recordingContext() {
  const arcs: Arc[] = [];
  const strokes: number[] = [];
  const pen = { globalAlpha: 1 };
  const context = {
    get globalAlpha() {
      return pen.globalAlpha;
    },
    set globalAlpha(alpha: number) {
      pen.globalAlpha = alpha;
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(() => strokes.push(pen.globalAlpha)),
    arc: jest.fn((x: number, y: number, radius: number) =>
      arcs.push({ x, y, radius, alpha: pen.globalAlpha })
    ),
  };
  return { context, arcs, strokes };
}

function setUp() {
  const recording = recordingContext();
  const canvas = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => recording.context),
  } as unknown as HTMLCanvasElement;
  const renderer = CanvasWaveRenderer.create(canvas, {
    dotSize: 2,
    color: { r: 200, g: 210, b: 220 },
  });
  if (renderer == null) {
    throw new Error('no renderer');
  }
  const geometry = waveGeometry(400, 100, { dotSpacing: 20, sweepMs: 1000 });
  renderer.resize(geometry, 2);
  return { ...recording, canvas, renderer, geometry };
}

describe('CanvasWaveRenderer', () => {
  it('is not created without a 2D context', () => {
    const canvas = {
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    expect(
      CanvasWaveRenderer.create(canvas, {
        dotSize: 1,
        color: { r: 0, g: 0, b: 0 },
      })
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
    renderer.setLook({ dotSize: 2, color: { r: 1, g: 2, b: 3, alpha: 0.5 } });
    renderer.draw({ elapsedMs: 500, wave: 0, dots: 1 });
    expect(arcs[0].alpha).toBeCloseTo(REST_ALPHA / 2, 9);
  });

  it('draws nothing in a transparent colour', () => {
    const { renderer, arcs } = setUp();
    renderer.setLook({ dotSize: 2, color: { r: 0, g: 0, b: 0, alpha: 0 } });
    renderer.draw({ elapsedMs: 500, wave: 1, dots: 1 });
    expect(arcs).toEqual([]);
  });
});
