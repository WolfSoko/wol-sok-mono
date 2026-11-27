import { CanvasWaveRenderer } from './canvas-wave-renderer';
import type { WaveRendererPreference } from './loading-wave-options';
import type { WaveLook, WaveRenderer } from './renderer';
import type { LoadingWaveShader } from './webgl/loading-wave-shader';
import { WebGlWaveRenderer } from './webgl/webgl-wave-renderer';

/**
 * Browsers drop the oldest WebGL context once about 16 are alive, so only
 * this many waves draw on the GPU at the same time; the rest use the 2D canvas.
 */
const MAX_GPU_WAVES = 8;

/** counts the waves that hold a WebGL context */
export class GpuContextBudget {
  private live = 0;

  public constructor(private readonly max = MAX_GPU_WAVES) {}

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

/** the budget all waves of the page share */
export const PAGE_GPU_BUDGET = new GpuContextBudget();

export interface ChooseWaveRendererParams {
  readonly preference: WaveRendererPreference;
  readonly look: WaveLook;
  /** what the WebGL renderer draws with */
  readonly shader: LoadingWaveShader;
  /** a new, detached canvas for each renderer tried */
  readonly createCanvas: () => HTMLCanvasElement;
  /** the WebGL renderer lost its context; swap it for a 2D one */
  readonly onContextLost: () => void;
  readonly gpuBudget?: GpuContextBudget;
}

/**
 * The WebGL renderer where WebGL2 runs (for `'auto'` only on a GPU, for
 * `'webgl'` also in software), the budget allows one more and the shaders
 * compile; the 2D canvas renderer otherwise and always for `'canvas'`.
 * `null` only where not even a 2D context exists.
 */
export function chooseWaveRenderer(
  params: ChooseWaveRendererParams
): WaveRenderer | null {
  const gpuRenderer =
    params.preference === 'canvas' ? null : tryWebGlRenderer(params);
  return (
    gpuRenderer ?? CanvasWaveRenderer.create(params.createCanvas(), params.look)
  );
}

function tryWebGlRenderer({
  preference,
  look,
  shader,
  createCanvas,
  onContextLost,
  gpuBudget = PAGE_GPU_BUDGET,
}: ChooseWaveRendererParams): WaveRenderer | null {
  if (!gpuBudget.tryAcquire()) {
    return null;
  }
  const canvas = createCanvas();
  // 'webgl' takes a software-rendered context too, 'auto' only a GPU's
  const gl = WebGlWaveRenderer.createContext(canvas, preference === 'auto');
  if (gl == null) {
    gpuBudget.release();
    return null;
  }
  try {
    return new WebGlWaveRenderer(canvas, gl, look, shader, {
      onContextLost,
      onDispose: () => gpuBudget.release(),
    });
  } catch (error) {
    console.warn('ws-loading-wave: drawing on a 2D canvas instead', error);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    gpuBudget.release();
    return null;
  }
}
