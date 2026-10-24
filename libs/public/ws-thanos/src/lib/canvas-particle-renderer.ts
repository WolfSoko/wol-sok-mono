import { AnimationState } from './animation.state';
import { ParticleRenderer, ParticleRendererParams } from './particle-renderer';
import {
  MIN_PARTICLE_ALPHA,
  PARTICLE_STATE_LENGTH,
  ParticleStateIndex as P,
  Particles,
} from './particles';
import { SimplexNoise } from './simplex-noise';
import { FLOW_FIELD, isBehindFront, vaporizingFront } from './vaporizing-front';

/** the CPU can't keep up with more particles than this */
export const CANVAS_MAX_PARTICLE_COUNT = 400_000;

const FLOW_FIELD_RES = 0.05;

export interface UpdateParticlesParams {
  particles: Particles;
  animationState: AnimationState;
  particleAcceleration: number;
  noise: SimplexNoise;
  seed: number;
}

/** Fallback renderer that simulates on the CPU and draws with a 2d context. */
export class CanvasParticleRenderer implements ParticleRenderer {
  public readonly kind = 'canvas';
  /** the CPU can't afford to simulate cracks and shards */
  public readonly crumble = 'dust';
  private readonly noise = new SimplexNoise({
    frequency: FLOW_FIELD.frequency,
    min: 0,
  });
  private readonly context: CanvasRenderingContext2D;

  public constructor(
    public readonly canvas: HTMLCanvasElement,
    private readonly particles: Particles,
    private readonly params: ParticleRendererParams
  ) {
    canvas.width = params.width;
    canvas.height = params.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context == null) {
      throw new Error('Could not get 2d context for vaporize canvas');
    }
    this.context = context;
  }

  public render(animationState: AnimationState): void {
    updateParticlesOnCpu({
      particles: this.particles,
      animationState,
      particleAcceleration: this.params.particleAcceleration,
      noise: this.noise,
      seed: this.params.seed,
    });
    drawParticlesOnCpu(this.context, this.particles);
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
  particles: { state, count, maxParticleX, minParticleY },
  animationState: { deltaTSec, animationT, maxWidth, maxHeight },
  particleAcceleration,
  noise,
  seed,
}: UpdateParticlesParams): void {
  const front = vaporizingFront(
    animationT,
    maxParticleX,
    minParticleY,
    maxHeight
  );

  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STATE_LENGTH;
    // only update particles that are inside view and visible
    if (!isVisibleInside(state, base, maxWidth, maxHeight)) {
      continue;
    }
    const particleX = state[base + P.X];
    const particleY = state[base + P.Y];

    if (state[base + P.RELEASED_AT] === 0) {
      if (
        isBehindFront(particleX, particleY, maxHeight, deltaTSec, seed, front)
      ) {
        state[base + P.RELEASED_AT] = Math.max(animationT, 0.0001);
        state[base + P.AX] = Math.random();
        state[base + P.AY] = Math.random() * -1;
      }
    } else {
      // flow along the noise velocity field
      state[base + P.AX] += noise.scaled3D(
        particleX,
        particleY,
        seed + FLOW_FIELD.xSeedOffset,
        FLOW_FIELD_RES
      );
      state[base + P.AY] -= noise.scaled3D(
        particleX,
        seed / FLOW_FIELD.ySeedDivisor,
        particleY,
        FLOW_FIELD_RES
      );
    }

    state[base + P.VX] += state[base + P.AX] * particleAcceleration * deltaTSec;
    state[base + P.VY] += state[base + P.AY] * particleAcceleration * deltaTSec;
    state[base + P.X] += state[base + P.VX] * deltaTSec;
    state[base + P.Y] += state[base + P.VY] * deltaTSec;
    state[base + P.ALPHA] *= front.fade;
  }
}

export function drawParticlesOnCpu(
  context: CanvasRenderingContext2D,
  { state, colors, count }: Particles
): void {
  const { width, height } = context.canvas;
  context.clearRect(0, 0, width, height);
  const image = context.getImageData(0, 0, width, height);
  const pixels = image.data;
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
