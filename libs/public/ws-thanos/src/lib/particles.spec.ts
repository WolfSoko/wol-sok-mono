import {
  createParticles,
  PARTICLE_STATE_LENGTH,
  ParticleStateIndex,
} from './particles';

function imageDataOf(
  width: number,
  height: number,
  opaque: (x: number, y: number) => boolean
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data.set([10 + x, 20 + y, 30, opaque(x, y) ? 200 : 0], i);
    }
  }
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

describe('createParticles', () => {
  it('should create one particle per visible pixel', () => {
    const image = imageDataOf(4, 3, (x) => x < 2);
    const particles = createParticles(image, 1000, 30);
    expect(particles.count).toBe(6);
    expect(particles.state.length).toBe(6 * PARTICLE_STATE_LENGTH);
    expect(particles.colors.length).toBe(6 * 4);
  });

  it('should randomly sample when more pixels than maxParticleCount are visible', () => {
    const particles = createParticles(
      imageDataOf(10, 10, () => true),
      25,
      50
    );
    expect(particles.count).toBe(25);
    expect(particles.state.length).toBe(25 * PARTICLE_STATE_LENGTH);
  });

  it('should place particles at the bottom of the taller effect canvas with the pixel color', () => {
    const particles = createParticles(
      imageDataOf(1, 2, (_, y) => y === 1),
      10,
      10
    );
    const s = particles.state;
    expect(s[ParticleStateIndex.X]).toBe(0);
    // pixel y=1 of a 2px image inside a 10px high effect canvas
    expect(s[ParticleStateIndex.Y]).toBe(1 + 10 - 2);
    expect(s[ParticleStateIndex.ALPHA]).toBe(200);
    expect(Array.from(particles.colors)).toEqual([10, 21, 30, 200]);
  });

  it('should tell when every visible pixel became a particle', () => {
    expect(
      createParticles(
        imageDataOf(4, 4, () => true),
        16,
        10
      ).sampled
    ).toBe(false);
  });

  it('should tell when the particles are only a sample of the pixels', () => {
    expect(
      createParticles(
        imageDataOf(4, 4, () => true),
        15,
        10
      ).sampled
    ).toBe(true);
  });

  it('should start particles at rest', () => {
    const particles = createParticles(
      imageDataOf(3, 3, () => true),
      100,
      30
    );
    for (let i = 0; i < particles.count; i++) {
      const base = i * PARTICLE_STATE_LENGTH;
      expect(particles.state[base + ParticleStateIndex.VX]).toBe(0);
      expect(particles.state[base + ParticleStateIndex.VY]).toBe(0);
      expect(particles.state[base + ParticleStateIndex.AX]).toBe(0);
      expect(particles.state[base + ParticleStateIndex.AY]).toBe(0);
    }
  });

  it('should report the vaporizing front bounds', () => {
    const particles = createParticles(
      imageDataOf(5, 5, (x, y) => x <= 3 && y >= 2),
      1000,
      25
    );
    expect(particles.maxParticleX).toBe(3);
    expect(particles.minParticleY).toBe(2);
  });
});
