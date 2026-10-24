import { AnimationState } from './animation.state';
import {
  drawParticlesOnCpu,
  updateParticlesOnCpu,
} from './canvas-particle-renderer';
import {
  createParticles,
  PARTICLE_STATE_LENGTH,
  ParticleStateIndex,
  Particles,
} from './particles';
import { SimplexNoise } from './simplex-noise';

describe('CanvasParticleRenderer', () => {
  const effectWidth = 40;
  const effectHeight = 100;

  function opaqueSquare(size: number): ImageData {
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    return { width: size, height: size, data, colorSpace: 'srgb' } as ImageData;
  }

  function animationState(animationT: number): AnimationState {
    return {
      animationT,
      deltaTSec: 1 / 60,
      maxWidth: effectWidth,
      maxHeight: effectHeight,
    };
  }

  function step(particles: Particles, animationT: number): void {
    updateParticlesOnCpu({
      particles,
      animationState: animationState(animationT),
      particleAcceleration: 30,
      noise: new SimplexNoise({ frequency: 0.01, min: 0 }),
      seed: 42,
    });
  }

  function valuesOf(particles: Particles, index: ParticleStateIndex): number[] {
    return Array.from(
      { length: particles.count },
      (_, i) => particles.state[i * PARTICLE_STATE_LENGTH + index]
    );
  }

  describe('updateParticlesOnCpu', () => {
    it('should blow particles upwards once the vaporizing front passed them', () => {
      const particles = createParticles(opaqueSquare(10), 1000, effectHeight);
      const startY = valuesOf(particles, ParticleStateIndex.Y);

      for (let frame = 0; frame < 10; frame++) {
        step(particles, 0.9);
      }

      const endY = valuesOf(particles, ParticleStateIndex.Y);
      const movedUp = endY.filter((y, i) => y < startY[i]).length;
      expect(movedUp).toBeGreaterThan(particles.count * 0.9);
    });

    it('should release particles along a frayed front without stray lines', () => {
      const width = 200;
      const height = 100;
      const data = new Uint8ClampedArray(width * height * 4).fill(255);
      const particles = createParticles(
        { width, height, data, colorSpace: 'srgb' } as ImageData,
        width * height,
        effectHeight * 5
      );
      const big = { maxWidth: width * 2, maxHeight: effectHeight * 5 };
      // distance from the bottom left corner, where the front ends
      const distance = valuesOf(particles, ParticleStateIndex.X).map((x, i) =>
        Math.hypot(
          x,
          big.maxHeight - valuesOf(particles, ParticleStateIndex.Y)[i]
        )
      );
      const noise = new SimplexNoise({ frequency: 0.01, min: 0 });

      // the first half of a 6 second animation at 60 fps
      for (let frame = 0; frame < 180; frame++) {
        updateParticlesOnCpu({
          particles,
          animationState: {
            animationT: (frame / 180) * 0.5,
            deltaTSec: 1 / 60,
            ...big,
          },
          particleAcceleration: 30,
          noise,
          seed: 42,
        });
      }

      const releasedAt = valuesOf(particles, ParticleStateIndex.RELEASED_AT);
      const released = distance.filter((_, i) => releasedAt[i] > 0);
      const waiting = distance.filter((_, i) => releasedAt[i] === 0);
      expect(released.length).toBeGreaterThan(0);
      expect(waiting.length).toBeGreaterThan(0);
      // the front frays a bit, but no particle far behind it breaks off early
      expect(Math.min(...released)).toBeGreaterThan(Math.max(...waiting) - 80);
    });

    it('should fade particles out at the end of the animation', () => {
      const particles = createParticles(opaqueSquare(4), 1000, effectHeight);
      step(particles, 1);
      expect(Math.max(...valuesOf(particles, ParticleStateIndex.ALPHA))).toBe(
        0
      );
    });

    it('should not move invisible particles', () => {
      const particles = createParticles(opaqueSquare(2), 1000, effectHeight);
      particles.state.fill(
        0,
        ParticleStateIndex.ALPHA,
        ParticleStateIndex.ALPHA + 1
      );
      const before = particles.state.slice(0, PARTICLE_STATE_LENGTH);

      step(particles, 0.9);

      expect(particles.state.slice(0, PARTICLE_STATE_LENGTH)).toEqual(before);
    });
  });

  describe('drawParticlesOnCpu', () => {
    it('should paint each visible particle with its color at its pixel', () => {
      const particles = createParticles(opaqueSquare(1), 10, 3);
      particles.colors.set([1, 2, 3, 255]);
      particles.state[ParticleStateIndex.X] = 1.7;
      particles.state[ParticleStateIndex.Y] = 2.2;
      particles.state[ParticleStateIndex.ALPHA] = 128;

      const image = { data: new Uint8ClampedArray(3 * 3 * 4) };
      const ctx = {
        canvas: { width: 3, height: 3 },
        clearRect: jest.fn(),
        getImageData: jest.fn(() => image),
        putImageData: jest.fn(),
      } as unknown as CanvasRenderingContext2D;

      drawParticlesOnCpu(ctx, particles);

      const pixel = (2 * 3 + 1) * 4;
      expect(Array.from(image.data.subarray(pixel, pixel + 4))).toEqual([
        1, 2, 3, 128,
      ]);
      expect(ctx.putImageData).toHaveBeenCalledWith(image, 0, 0);
    });
  });
});
