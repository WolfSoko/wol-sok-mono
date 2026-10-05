import { AnimationState } from './animation.state';
import { ParticleRenderer, ParticleRendererParams } from './particle-renderer';
import {
  MIN_PARTICLE_ALPHA,
  PARTICLE_STATE_LENGTH,
  ParticleStateIndex as P,
  Particles,
} from './particles';
import { SimplexNoise } from './simplex-noise';

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
  private readonly noise = new SimplexNoise({ frequency: 0.01, min: 0 });
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
  // the time is used to calculate the vaporization front.
  const time = Math.sin(animationT * (Math.PI / 2)) * 1.1;

  const startAccelerateX = maxParticleX - time * maxParticleX;
  const startAccelerateY = time * (maxHeight - minParticleY) + minParticleY;

  const lengthY = maxHeight - startAccelerateY;
  const accelerateRadiusPow =
    startAccelerateX * startAccelerateX + lengthY * lengthY;
  const fade = 1 - Math.pow(animationT, 15);

  for (let i = 0; i < count; i++) {
    const base = i * PARTICLE_STATE_LENGTH;
    // only update particles that are inside view and visible
    if (!isVisibleInside(state, base, maxWidth, maxHeight)) {
      continue;
    }
    const particleX = state[base + P.X];
    const particleY = state[base + P.Y];

    if (state[base + P.AX] === 0 && state[base + P.AY] === 0) {
      let pYLength = maxHeight - particleY;
      let pXLength = particleX;

      // some random looking functions give the vaporizing front a frayed edge.
      // no tan(): its poles would break off whole rows and columns at once
      pXLength += (particleX % deltaTSec) * 0.5;
      pXLength += Math.sin((pXLength / 30 + 723.394) * time + seed * 12.5) * 11;
      pYLength +=
        Math.cos((pYLength / 100 + 2323.234) * time + seed * 456.1) * 23;

      const pLength = pXLength * pXLength + pYLength * pYLength;
      if (pLength > accelerateRadiusPow) {
        state[base + P.AX] = Math.random();
        state[base + P.AY] = Math.random() * -1;
      }
    } else {
      // flow along the noise velocity field
      state[base + P.AX] += noise.scaled3D(
        particleX,
        particleY,
        seed + 33.23,
        FLOW_FIELD_RES
      );
      state[base + P.AY] -= noise.scaled3D(
        particleX,
        seed / 13.23,
        particleY,
        FLOW_FIELD_RES
      );
    }

    state[base + P.VX] += state[base + P.AX] * particleAcceleration * deltaTSec;
    state[base + P.VY] += state[base + P.AY] * particleAcceleration * deltaTSec;
    state[base + P.X] += state[base + P.VX] * deltaTSec;
    state[base + P.Y] += state[base + P.VY] * deltaTSec;
    // fade particle out (very late)
    state[base + P.ALPHA] *= fade;
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
