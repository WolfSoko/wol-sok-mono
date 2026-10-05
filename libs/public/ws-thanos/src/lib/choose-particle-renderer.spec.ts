import {
  CANVAS_MAX_PARTICLE_COUNT,
  CanvasParticleRenderer,
} from './canvas-particle-renderer';
import { chooseParticleRenderer } from './choose-particle-renderer';
import { createParticles } from './particles';
import { WebGlParticleRenderer } from './webgl/webgl-particle-renderer';

/** a WebGL2 context that answers every call, enough to set up the renderer */
function fakeWebGl2(
  overrides: Record<string, unknown> = {}
): WebGL2RenderingContext {
  const values: Record<string, unknown> = {
    getParameter: () => 4096,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => 'compile error',
    getProgramInfoLog: () => 'link error',
    getExtension: () => null,
    isContextLost: () => false,
    ...overrides,
  };
  return new Proxy({} as WebGL2RenderingContext, {
    get: (_, prop: string) =>
      prop in values
        ? values[prop]
        : /^[A-Z_0-9]+$/.test(prop)
          ? 1
          : () => ({}),
  });
}

function fakeCanvas(contexts: {
  webgl2?: unknown;
  '2d'?: unknown;
}): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.getContext = jest.fn(
    (type: string) => (contexts as Record<string, unknown>)[type] ?? null
  ) as unknown as HTMLCanvasElement['getContext'];
  return canvas;
}

const fake2d = { canvas: {} } as CanvasRenderingContext2D;
const particles = createParticles(
  {
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([1, 2, 3, 255]),
  } as ImageData,
  10,
  5
);
const rendererParams = {
  width: 2,
  height: 5,
  particleAcceleration: 30,
  seed: 1,
};

describe('chooseParticleRenderer', () => {
  describe('without WebGL2', () => {
    const choose = (maxParticleCount = 1_500_000) =>
      chooseParticleRenderer({
        maxParticleCount,
        devicePixelRatio: 2,
        createCanvas: () => fakeCanvas({ '2d': fake2d }),
      });

    it('should fall back to the canvas renderer', () => {
      expect(choose().kind).toBe('canvas');
      expect(choose().create(particles, rendererParams)).toBeInstanceOf(
        CanvasParticleRenderer
      );
    });

    it('should capture at css pixels to keep the CPU work low', () => {
      expect(choose().captureScale(300, 400)).toBe(1);
    });

    it('should cap the particles to what the CPU can handle', () => {
      expect(choose().maxParticleCount).toBe(CANVAS_MAX_PARTICLE_COUNT);
      expect(choose(500).maxParticleCount).toBe(500);
    });
  });

  describe('with WebGL2', () => {
    const choose = (gl = fakeWebGl2()) =>
      chooseParticleRenderer({
        maxParticleCount: 1_500_000,
        devicePixelRatio: 2,
        createCanvas: () => fakeCanvas({ webgl2: gl, '2d': fake2d }),
      });

    it('should render on the GPU', () => {
      expect(choose().kind).toBe('webgl');
      expect(choose().create(particles, rendererParams)).toBeInstanceOf(
        WebGlParticleRenderer
      );
    });

    it('should use all configured particles', () => {
      expect(choose().maxParticleCount).toBe(1_500_000);
    });

    it('should capture at device pixels within the GPU canvas limit', () => {
      expect(choose().captureScale(300, 400)).toBe(2);
      // 4096 / (800 * 5)
      expect(choose().captureScale(300, 800)).toBeCloseTo(1.024);
    });

    it('should fall back to the canvas renderer when the GPU setup fails', () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const brokenGl = fakeWebGl2({ getShaderParameter: () => false });
      expect(choose(brokenGl).create(particles, rendererParams)).toBeInstanceOf(
        CanvasParticleRenderer
      );
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
