import { AnimationState } from './animation.state';
import { ParticleRenderer, ParticleRendererParams } from './particle-renderer';
import {
  MIN_PARTICLE_ALPHA,
  PARTICLE_STATE_LENGTH,
  ParticleStateIndex as P,
  Particles,
} from './particles';
import { FlowField } from './flow-field';
import { FRAME_RATE, frameFade } from './frame-rate';
import { isBehindFront, vaporizingFront } from './vaporizing-front';

/** the CPU can't keep up with more particles than this */
export const CANVAS_MAX_PARTICLE_COUNT = 400_000;

export interface UpdateParticlesParams {
  particles: Particles;
  animationState: AnimationState;
  params: Pick<
    ParticleRendererParams,
    'particleAcceleration' | 'seed' | 'wind' | 'front'
  >;
  flowField: FlowField;
}

/** Fallback renderer that simulates on the CPU and draws with a 2d context. */
export class CanvasParticleRenderer implements ParticleRenderer {
  public readonly kind = 'canvas';
  /** the CPU can't afford to simulate cracks and shards */
  public readonly crumble = 'dust';
  private readonly flowField: FlowField;
  private readonly context: CanvasRenderingContext2D;
  /** drawn into and put on the canvas every frame */
  private readonly image: ImageData;

  public constructor(
    public readonly canvas: HTMLCanvasElement,
    private readonly particles: Particles,
    private readonly params: ParticleRendererParams
  ) {
    canvas.width = params.width;
    canvas.height = params.height;
    const context = canvas.getContext('2d');
    if (context == null) {
      throw new Error('Could not get 2d context for vaporize canvas');
    }
    this.context = context;
    this.image = context.createImageData(params.width, params.height);
    this.flowField = new FlowField(
      params.width,
      params.height,
      params.seed,
      params.wind
    );
  }

  public render(animationState: AnimationState): void {
    updateParticlesOnCpu({
      particles: this.particles,
      animationState,
      params: this.params,
      flowField: this.flowField,
    });
    drawParticlesOnCpu(this.context, this.image, this.particles);
  }

  public dispose(): void {
    this.canvas.remove();
  }
}

function isVisibleInside(
  state: Float32Array,
  base: number,
  width: number,
  height: number
): boolean {
  const x = state[base + P.X];
  const y = state[base + P.Y];
  return (
    x <= width &&
    x >= 0 &&
    y <= height &&
    y >= 0 &&
    state[base + P.ALPHA] >= MIN_PARTICLE_ALPHA
  );
}

export function updateParticlesOnCpu({
  particles: { state, count },
  animationState: { deltaTSec, animationT, maxWidth, maxHeight },
  params: { particleAcceleration, seed, wind, front: frontGeometry },
  flowField,
}: UpdateParticlesParams): void {
  const front = vaporizingFront(animationT, frontGeometry);
  const fade = frameFade(front.fade, deltaTSec);
  // the flow field pushes as much per second at any frame rate
  const flowPerFrame = deltaTSec * FRAME_RATE;
  const flow = new Float32Array(2);
  // the release push is written for the default wind and turned into this one
  const { cos, sin } = wind;

  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STATE_LENGTH;
    // only update particles that are inside view and visible
    if (!isVisibleInside(state, base, maxWidth, maxHeight)) {
      continue;
    }
    const particleX = state[base + P.X];
    const particleY = state[base + P.Y];

    if (state[base + P.RELEASED_AT] === 0) {
      if (isBehindFront(particleX, particleY, deltaTSec, seed, front)) {
        state[base + P.RELEASED_AT] = Math.max(animationT, 0.0001);
        const ax = Math.random();
        const ay = -Math.random();
        state[base + P.AX] = cos * ax - sin * ay;
        state[base + P.AY] = sin * ax + cos * ay;
      }
    } else {
      // flow along the noise velocity field
      flowField.sample(particleX, particleY, flow);
      state[base + P.AX] += flow[0] * flowPerFrame;
      state[base + P.AY] += flow[1] * flowPerFrame;
    }

    state[base + P.VX] += state[base + P.AX] * particleAcceleration * deltaTSec;
    state[base + P.VY] += state[base + P.AY] * particleAcceleration * deltaTSec;
    state[base + P.X] += state[base + P.VX] * deltaTSec;
    state[base + P.Y] += state[base + P.VY] * deltaTSec;
    state[base + P.ALPHA] *= fade;
  }
}

/** paints the particles into image and puts it on the canvas, image has the canvas size */
export function drawParticlesOnCpu(
  context: CanvasRenderingContext2D,
  image: ImageData,
  { state, colors, count }: Particles
): void {
  const { width, height } = image;
  const pixels = image.data;
  // putImageData replaces every pixel, so clearing the image clears the canvas
  pixels.fill(0);
  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STATE_LENGTH;
    if (!isVisibleInside(state, base, width, height)) {
      continue;
    }
    const pixel = (~~state[base + P.Y] * width + ~~state[base + P.X]) * 4;
    pixels[pixel] = colors[i * 4];
    pixels[pixel + 1] = colors[i * 4 + 1];
    pixels[pixel + 2] = colors[i * 4 + 2];
    pixels[pixel + 3] = ~~state[base + P.ALPHA];
  }
  context.putImageData(image, 0, 0);
}
