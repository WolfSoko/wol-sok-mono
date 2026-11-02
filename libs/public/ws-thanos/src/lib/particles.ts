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
  /** animationT when the particle broke off, 0 while attached, negative while a chunk falls */
  RELEASED_AT = 7,
}

export const PARTICLE_STATE_LENGTH = 8;

/** box around the visible particles in effect canvas pixels, edges included */
export interface ParticleBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Particles {
  count: number;
  /** position, velocity, acceleration, alpha (0-255) and release time per particle */
  state: Float32Array;
  /** rgba (0-255) per particle */
  colors: Uint8Array;
  /** where the particles are at the start, the vaporizing front sweeps through this box */
  bounds: ParticleBounds;
  /** true when only a random sample of the visible pixels became particles */
  sampled: boolean;
}

/**
 * Creates one particle per visible pixel, randomly sampled down to maxParticleCount.
 * The element's top left corner sits at offset in the effect canvas.
 */
export function createParticles(
  imageData: ImageData,
  maxParticleCount: number,
  offset: { x: number; y: number }
): Particles {
  const { width, height, data } = imageData;

  const candidates = new Uint32Array(width * height);
  let candidateCount = 0;
  for (let pixel = 0; pixel < width * height; pixel++) {
    if (data[pixel * 4 + 3] >= MIN_PARTICLE_ALPHA) {
      candidates[candidateCount++] = pixel;
    }
  }

  const count = Math.min(candidateCount, maxParticleCount);
  const sampled = count < candidateCount;
  if (sampled) {
    // partial Fisher-Yates: the first count candidates become a random sample
    for (let i = 0; i < count; i++) {
      const j = i + ~~(Math.random() * (candidateCount - i));
      const swap = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = swap;
    }
  }

  const state = new Float32Array(count * PARTICLE_STATE_LENGTH);
  const colors = new Uint8Array(count * 4);

  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;
  for (let i = 0; i < count; i++) {
    const pixel = candidates[i];
    const x = pixel % width;
    const y = ~~(pixel / width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);

    const base = i * PARTICLE_STATE_LENGTH;
    state[base + ParticleStateIndex.X] = x + offset.x;
    state[base + ParticleStateIndex.Y] = y + offset.y;
    state[base + ParticleStateIndex.ALPHA] = data[pixel * 4 + 3];
    colors[i * 4] = data[pixel * 4];
    colors[i * 4 + 1] = data[pixel * 4 + 1];
    colors[i * 4 + 2] = data[pixel * 4 + 2];
    colors[i * 4 + 3] = data[pixel * 4 + 3];
  }
  // without particles left > right and top > bottom, there is nothing to sweep
  const bounds = {
    left: left + offset.x,
    top: top + offset.y,
    right: right + offset.x,
    bottom: bottom + offset.y,
  };
  return { count, state, colors, bounds, sampled };
}

/** a random sample of at most maxCount particles, e.g. when the CPU takes over from the GPU */
export function limitParticles(
  particles: Particles,
  maxCount: number
): Particles {
  if (particles.count <= maxCount) {
    return particles;
  }
  const indices = new Uint32Array(particles.count);
  for (let i = 0; i < particles.count; i++) {
    indices[i] = i;
  }
  const state = new Float32Array(maxCount * PARTICLE_STATE_LENGTH);
  const colors = new Uint8Array(maxCount * 4);
  for (let i = 0; i < maxCount; i++) {
    // partial Fisher-Yates over the particle indices
    const j = i + ~~(Math.random() * (particles.count - i));
    const picked = indices[j];
    indices[j] = indices[i];
    state.set(
      particles.state.subarray(
        picked * PARTICLE_STATE_LENGTH,
        (picked + 1) * PARTICLE_STATE_LENGTH
      ),
      i * PARTICLE_STATE_LENGTH
    );
    colors.set(particles.colors.subarray(picked * 4, picked * 4 + 4), i * 4);
  }
  return { ...particles, count: maxCount, state, colors, sampled: true };
}
