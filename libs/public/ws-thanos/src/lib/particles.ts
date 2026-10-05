/** alpha (0-255) below which a particle counts as invisible */
export const MIN_PARTICLE_ALPHA = ~~(255 * 0.01);

/** float layout of one particle in {@link Particles.state} */
export enum ParticleStateIndex {
  X = 0,
  Y = 1,
  VX = 2,
  VY = 3,
  AX = 4,
  AY = 5,
  ALPHA = 6,
}

export const PARTICLE_STATE_LENGTH = 7;

export interface Particles {
  count: number;
  /** position, velocity, acceleration and alpha (0-255) per particle */
  state: Float32Array;
  /** rgba (0-255) per particle */
  colors: Uint8Array;
  /** right most particle x of the captured image, the vaporizing front starts here */
  maxParticleX: number;
  /** top most particle y of the captured image */
  minParticleY: number;
}

/**
 * Creates one particle per visible pixel, randomly sampled down to maxParticleCount.
 * Particles are placed at the bottom of an effect canvas of the given height.
 */
export function createParticles(
  imageData: ImageData,
  maxParticleCount: number,
  effectHeight: number
): Particles {
  const { width, height, data } = imageData;

  const candidates: number[] = [];
  for (let pixel = 0; pixel < width * height; pixel++) {
    if (data[pixel * 4 + 3] >= MIN_PARTICLE_ALPHA) {
      candidates.push(pixel);
    }
  }

  const count = Math.min(candidates.length, maxParticleCount);
  const state = new Float32Array(count * PARTICLE_STATE_LENGTH);
  const colors = new Uint8Array(count * 4);
  const offsetY = effectHeight - height;

  let maxParticleX = 0;
  let minParticleY = effectHeight;
  for (let i = 0; i < count; i++) {
    // pick a random candidate and replace it with the last one to prevent double selection
    const index = ~~(Math.random() * candidates.length);
    const pixel = candidates[index];
    candidates[index] = candidates[candidates.length - 1];
    candidates.pop();

    const x = pixel % width;
    const y = ~~(pixel / width);
    maxParticleX = Math.max(maxParticleX, x);
    minParticleY = Math.min(minParticleY, y);

    const base = i * PARTICLE_STATE_LENGTH;
    state[base + ParticleStateIndex.X] = x;
    state[base + ParticleStateIndex.Y] = y + offsetY;
    state[base + ParticleStateIndex.ALPHA] = data[pixel * 4 + 3];
    colors.set(data.subarray(pixel * 4, pixel * 4 + 4), i * 4);
  }
  return { count, state, colors, maxParticleX, minParticleY };
}
