import { computeCaptureScale } from './capture-scale';
import {
  CANVAS_MAX_PARTICLE_COUNT,
  CanvasParticleRenderer,
} from './canvas-particle-renderer';
import { ParticleRenderer, ParticleRendererParams } from './particle-renderer';
import { Particles } from './particles';
import { WebGlParticleRenderer } from './webgl/webgl-particle-renderer';

export interface ChooseParticleRendererParams {
  maxParticleCount: number;
  devicePixelRatio: number;
  createCanvas: () => HTMLCanvasElement;
}

export interface ParticleRendererChoice {
  /** how many particles this renderer can handle */
  readonly maxParticleCount: number;
  /** scale to capture an element of the given css size */
  captureScale(width: number, height: number): number;
  create(
    particles: Particles,
    params: ParticleRendererParams
  ): ParticleRenderer;
  /** free what was prepared when no renderer gets created */
  discard(): void;
}

/**
 * Picks the GPU renderer when WebGL2 is available and the CPU canvas renderer otherwise.
 * If the GPU renderer fails to set up, it falls back to the canvas renderer.
 */
export function chooseParticleRenderer({
  maxParticleCount,
  devicePixelRatio,
  createCanvas,
}: ChooseParticleRendererParams): ParticleRendererChoice {
  const createCanvasRenderer = (
    particles: Particles,
    params: ParticleRendererParams
  ): ParticleRenderer =>
    new CanvasParticleRenderer(createCanvas(), particles, params);

  const canvas = createCanvas();
  const gl = WebGlParticleRenderer.createContext(canvas);
  if (gl == null) {
    return {
      maxParticleCount: Math.min(maxParticleCount, CANVAS_MAX_PARTICLE_COUNT),
      captureScale: () => 1,
      create: createCanvasRenderer,
      discard: () => undefined,
    };
  }

  const loseContext = () =>
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  const maxCanvasSize = WebGlParticleRenderer.maxCanvasSize(gl);
  return {
    maxParticleCount,
    captureScale: (width, height) =>
      computeCaptureScale({ width, height, devicePixelRatio, maxCanvasSize }),
    create: (particles, params) => {
      try {
        return new WebGlParticleRenderer(canvas, gl, particles, params);
      } catch (error) {
        console.warn('ws-thanos: falling back to canvas rendering', error);
        loseContext();
        return createCanvasRenderer(particles, params);
      }
    },
    discard: loseContext,
  };
}
