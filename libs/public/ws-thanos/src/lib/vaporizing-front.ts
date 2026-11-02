import type { ParticleBounds } from './particles';
import type { Wind } from './wind';

/**
 * The vaporizing front sweeps against the wind through the element.
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

/** where the front starts and how far it reaches, in effect canvas pixels */
export interface FrontGeometry {
  /** upwind point of the element, the front sweeps towards it */
  originX: number;
  originY: number;
  /** distance from the origin at which the front starts */
  reach: number;
}

export interface VaporizingFront {
  /** drives the fray waves */
  time: number;
  originX: number;
  originY: number;
  /** particles further than this (squared) from the origin break off */
  radiusPow: number;
  /** alpha factor that fades the particles out very late */
  fade: number;
}

/**
 * The front starts at the downwind side and sweeps against the wind to the upwind point of the element,
 * for the default wind from the top right to the bottom left corner.
 * It starts out as far as the room above or below the element reaches,
 * so the element cracks first and only later blows away.
 */
export function frontGeometry(
  bounds: ParticleBounds,
  wind: Pick<Wind, 'x' | 'y'>,
  margins: { top: number; bottom: number }
): FrontGeometry {
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;
  // the point where a ray from the center against the wind leaves the box
  const toEdge = Math.max(Math.abs(wind.x), Math.abs(wind.y)) || 1;
  const originX =
    centerX - (wind.x / toEdge) * ((bounds.right - bounds.left) / 2);
  const originY =
    centerY - (wind.y / toEdge) * ((bounds.bottom - bounds.top) / 2);

  let reach = 0;
  for (const x of [bounds.left, bounds.right]) {
    for (const y of [bounds.top, bounds.bottom]) {
      const dy = y - originY;
      const room = dy < 0 ? margins.top : dy > 0 ? margins.bottom : 0;
      reach = Math.max(reach, Math.hypot(x - originX, Math.abs(dy) + room));
    }
  }
  return { originX, originY, reach };
}

/** where the front is at the given animation progress */
export function vaporizingFront(
  animationT: number,
  { originX, originY, reach }: FrontGeometry
): VaporizingFront {
  const time = Math.sin(animationT * (Math.PI / 2)) * 1.1;
  const radius = reach * (1 - time);
  return {
    time,
    originX,
    originY,
    radiusPow: radius * radius,
    fade: 1 - Math.pow(animationT, 15),
  };
}

/** has the front passed the particle at x, y. No tan() waves: their poles break off whole rows */
export function isBehindFront(
  x: number,
  y: number,
  deltaTSec: number,
  seed: number,
  { time, originX, originY, radiusPow }: VaporizingFront
): boolean {
  const f = FRONT_FRAY;
  let pXLength = x - originX + (x % deltaTSec) * 0.5;
  let pYLength = originY - y;
  pXLength +=
    Math.sin((pXLength / f.xWave + f.xPhase) * time + seed * f.xSeed) *
    f.xAmplitude;
  pYLength +=
    Math.cos((pYLength / f.yWave + f.yPhase) * time + seed * f.ySeed) *
    f.yAmplitude;
  return pXLength * pXLength + pYLength * pYLength > radiusPow;
}
