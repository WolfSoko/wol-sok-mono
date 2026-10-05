import { computeCaptureScale } from './capture-scale';
import {
  CANVAS_MAX_PARTICLE_COUNT,
  CanvasParticleRenderer,
} from './canvas-particle-renderer';
import { ParticleRenderer, ParticleRendererParams } from './particle-renderer';
import { limitParticles, Particles } from './particles';
import { WebGlParticleRenderer } from './webgl/webgl-particle-renderer';

/**
 * Browsers drop the oldest WebGL context once about 16 are alive,
 * so only this many effects run on the GPU at the same time.
 */
const MAX_GPU_EFFECTS = 12;

/** counts the effects that hold a WebGL context */
export class GpuContextBudget {
  private live = 0;

  public constructor(private readonly max = MAX_GPU_EFFECTS) {}

  public tryAcquire(): boolean {
    if (this.live >= this.max) {
      return false;
    }
    this.live++;
    return true;
  }

  public release(): void {
    this.live = Math.max(0, this.live - 1);
  }
}

export interface ChooseParticleRendererParams {
  maxParticleCount: number;
  devicePixelRatio: number;
  createCanvas: () => HTMLCanvasElement;
  gpuBudget?: GpuContextBudget;
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
  /** free the reserved GPU context, call it once the effect is over */
  release(): void;
}

/**
 * Picks the GPU renderer when WebGL2 is available and the GPU budget allows it,
 * the CPU canvas renderer otherwise. If the GPU renderer fails to set up,
 * it falls back to the canvas renderer.
 */
export function chooseParticleRenderer({
  maxParticleCount,
  devicePixelRatio,
  createCanvas,
  gpuBudget = new GpuContextBudget(),
}: ChooseParticleRendererParams): ParticleRendererChoice {
  const createCanvasRenderer = (
    particles: Particles,
    params: ParticleRendererParams
  ): ParticleRenderer =>
    new CanvasParticleRenderer(
      createCanvas(),
      limitParticles(particles, CANVAS_MAX_PARTICLE_COUNT),
      params
    );
  const canvasChoice: ParticleRendererChoice = {
    maxParticleCount: Math.min(maxParticleCount, CANVAS_MAX_PARTICLE_COUNT),
    captureScale: () => 1,
    create: createCanvasRenderer,
    release: () => undefined,
  };

  if (!gpuBudget.tryAcquire()) {
    return canvasChoice;
  }
  const canvas = createCanvas();
  const gl = WebGlParticleRenderer.createContext(canvas);
  if (gl == null) {
    gpuBudget.release();
    return canvasChoice;
  }

  let released = false;
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    // the renderer may have freed it already
    if (!gl.isContextLost()) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    gpuBudget.release();
  };
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
        release();
        return createCanvasRenderer(particles, params);
      }
    },
    release,
  };
}
