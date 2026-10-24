/**
 * The vaporizing front sweeps from the top right to the bottom left of the element.
 * Shared by the CPU and the GPU simulation, the GPU gets the values below as uniforms
 * and the constants interpolated into its shader.
 */

/** some random looking waves give the front a frayed edge */
export const FRONT_FRAY = {
  xWave: 30,
  xPhase: 723.394,
  xSeed: 12.5,
  xAmplitude: 11,
  yWave: 100,
  yPhase: 2323.234,
  ySeed: 456.1,
  yAmplitude: 23,
} as const;

/** the noise field released particles flow along */
export const FLOW_FIELD = {
  frequency: 0.01,
  xSeedOffset: 33.23,
  ySeedDivisor: 13.23,
} as const;

export interface VaporizingFront {
  /** drives the fray waves */
  time: number;
  /** particles further than this (squared) from the bottom left corner break off */
  radiusPow: number;
  /** alpha factor that fades the particles out very late */
  fade: number;
}

/** where the front is at the given animation progress */
export function vaporizingFront(
  animationT: number,
  maxParticleX: number,
  minParticleY: number,
  height: number
): VaporizingFront {
  const time = Math.sin(animationT * (Math.PI / 2)) * 1.1;
  const startAccelerateX = maxParticleX - time * maxParticleX;
  const startAccelerateY = time * (height - minParticleY) + minParticleY;
  const lengthY = height - startAccelerateY;
  return {
    time,
    radiusPow: startAccelerateX * startAccelerateX + lengthY * lengthY,
    fade: 1 - Math.pow(animationT, 15),
  };
}

/** has the front passed the particle at x, y. No tan() waves: their poles break off whole rows */
export function isBehindFront(
  x: number,
  y: number,
  height: number,
  deltaTSec: number,
  seed: number,
  { time, radiusPow }: VaporizingFront
): boolean {
  const f = FRONT_FRAY;
  let pXLength = x + (x % deltaTSec) * 0.5;
  let pYLength = height - y;
  pXLength +=
    Math.sin((pXLength / f.xWave + f.xPhase) * time + seed * f.xSeed) *
    f.xAmplitude;
  pYLength +=
    Math.cos((pYLength / f.yWave + f.yPhase) * time + seed * f.ySeed) *
    f.yAmplitude;
  return pXLength * pXLength + pYLength * pYLength > radiusPow;
}
