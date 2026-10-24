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
import { FlowField } from './flow-field';
import { SimplexNoise } from './simplex-noise';
import { frontGeometry } from './vaporizing-front';
import { windOf } from './wind';

describe('CanvasParticleRenderer', () => {
  const effectWidth = 40;
  const effectHeight = 100;
  const flowField = new FlowField(
    effectWidth,
    effectHeight,
    42,
    undefined,
    new SimplexNoise({ random: seededRandom() })
  );

  /** the same numbers in every run */
  function seededRandom(): () => number {
    let seed = 1;
    return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  }

  function opaqueSquare(size: number): ImageData {
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    return { width: size, height: size, data, colorSpace: 'srgb' } as ImageData;
  }

  /** a square at the bottom left of the effect canvas, where the default wind needs it */
  function squareParticles(size: number): Particles {
    return createParticles(opaqueSquare(size), 1000, {
      x: 0,
      y: effectHeight - size,
    });
  }

  function step(
    particles: Particles,
    animationT: number,
    { windDirection = 45, deltaTSec = 1 / 60 } = {}
  ): void {
    const wind = windOf(windDirection);
    updateParticlesOnCpu({
      particles,
      animationState: {
        animationT,
        deltaTSec,
        maxWidth: effectWidth,
        maxHeight: effectHeight,
      },
      params: {
        particleAcceleration: 30,
        seed: 42,
        wind,
        front: frontGeometry(particles.bounds, wind, { top: 0, bottom: 0 }),
      },
      flowField,
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
      const particles = squareParticles(10);
      const startY = valuesOf(particles, ParticleStateIndex.Y);

      for (let frame = 0; frame < 10; frame++) {
        step(particles, 0.9);
      }

      const endY = valuesOf(particles, ParticleStateIndex.Y);
      const movedUp = endY.filter((y, i) => y < startY[i]).length;
      expect(movedUp).toBeGreaterThan(particles.count * 0.9);
    });

    it('should blow particles the way the wind blows', () => {
      // in the middle of the canvas, so particles may leave it in any direction
      const particles = createParticles(opaqueSquare(10), 1000, {
        x: 15,
        y: 45,
      });
      const startX = valuesOf(particles, ParticleStateIndex.X);
      const startY = valuesOf(particles, ParticleStateIndex.Y);

      // to the left
      for (let frame = 0; frame < 10; frame++) {
        step(particles, 0.9, { windDirection: 270 });
      }

      const dx = valuesOf(particles, ParticleStateIndex.X).map(
        (x, i) => x - startX[i]
      );
      const dy = valuesOf(particles, ParticleStateIndex.Y).map(
        (y, i) => y - startY[i]
      );
      const mean = (values: number[]) =>
        values.reduce((sum, value) => sum + value, 0) / values.length;
      expect(mean(dx)).toBeLessThan(0);
      expect(Math.abs(mean(dy))).toBeLessThan(Math.abs(mean(dx)) / 2);
    });

    it('should move particles as far at any frame rate', () => {
      const at60 = squareParticles(10);
      const at120 = squareParticles(10);
      // release them all at once
      step(at60, 0.9, { deltaTSec: 0.0001 });
      at120.state.set(at60.state);

      for (let frame = 0; frame < 20; frame++) {
        step(at60, 0.5, { deltaTSec: 1 / 60 });
        step(at120, 0.5, { deltaTSec: 1 / 120 });
        step(at120, 0.5, { deltaTSec: 1 / 120 });
      }

      const distance = (particles: Particles) =>
        valuesOf(particles, ParticleStateIndex.Y).reduce(
          (sum, y) => sum + (effectHeight - y),
          0
        );
      expect(distance(at120) / distance(at60)).toBeCloseTo(1, 1);
    });

    it('should release particles along a frayed front without stray lines', () => {
      const width = 200;
      const height = 100;
      const data = new Uint8ClampedArray(width * height * 4).fill(255);
      const big = { maxWidth: width * 2, maxHeight: effectHeight * 5 };
      const particles = createParticles(
        { width, height, data, colorSpace: 'srgb' } as ImageData,
        width * height,
        { x: 0, y: big.maxHeight - height }
      );
      const wind = windOf();
      const params = {
        particleAcceleration: 30,
        seed: 42,
        wind,
        front: frontGeometry(particles.bounds, wind, {
          top: big.maxHeight - height,
          bottom: 0,
        }),
      };
      // distance from the bottom left corner, where the front ends
      const distance = valuesOf(particles, ParticleStateIndex.X).map((x, i) =>
        Math.hypot(
          x,
          big.maxHeight - valuesOf(particles, ParticleStateIndex.Y)[i]
        )
      );
      const flowField = new FlowField(big.maxWidth, big.maxHeight, 42);

      // the first half of a 6 second animation at 60 fps
      for (let frame = 0; frame < 180; frame++) {
        updateParticlesOnCpu({
          particles,
          animationState: {
            animationT: (frame / 180) * 0.5,
            deltaTSec: 1 / 60,
            ...big,
          },
          params,
          flowField,
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
      const particles = squareParticles(4);
      step(particles, 1);
      expect(Math.max(...valuesOf(particles, ParticleStateIndex.ALPHA))).toBe(
        0
      );
    });

    it('should not move invisible particles', () => {
      const particles = squareParticles(2);
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
      const particles = createParticles(opaqueSquare(1), 10, { x: 0, y: 2 });
      particles.colors.set([1, 2, 3, 255]);
      particles.state[ParticleStateIndex.X] = 1.7;
      particles.state[ParticleStateIndex.Y] = 2.2;
      particles.state[ParticleStateIndex.ALPHA] = 128;

      // the last frame left a pixel behind
      const image = {
        width: 3,
        height: 3,
        data: new Uint8ClampedArray(3 * 3 * 4).fill(255, 0, 4),
      } as ImageData;
      const ctx = {
        putImageData: jest.fn(),
      } as unknown as CanvasRenderingContext2D;

      drawParticlesOnCpu(ctx, image, particles);

      const pixel = (2 * 3 + 1) * 4;
      expect(Array.from(image.data.subarray(pixel, pixel + 4))).toEqual([
        1, 2, 3, 128,
      ]);
      expect(Array.from(image.data.subarray(0, 4))).toEqual([0, 0, 0, 0]);
      expect(ctx.putImageData).toHaveBeenCalledWith(image, 0, 0);
    });
  });
});
