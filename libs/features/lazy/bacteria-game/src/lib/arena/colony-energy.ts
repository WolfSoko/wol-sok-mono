import { GameBalance, Point } from '@wolsok/feat-shared-bacteria-engine';
import { hash } from './canvas-math';

/** The shimmer of a boosted colony at one moment. */
export interface BoostShimmer {
  timeSec: number;
  /** The crosshair the waves run into, in arena cells. */
  target: Point;
  /** Arena cells per cell of the base arena - the waves are as wide on any grid. */
  unit: number;
}

/**
 * The waves of light of a boosted colony at a cell, 0 to 1. Their crests
 * close in on the crosshair, so the colony visibly rushes towards it.
 */
export function shimmerAt(x: number, y: number, shimmer: BoostShimmer): number {
  const distance =
    Math.hypot(x - shimmer.target.x, y - shimmer.target.y) / shimmer.unit;
  const wave = 0.5 + 0.5 * Math.sin(shimmer.timeSec * 9 + distance * 0.35);
  const squared = wave * wave;
  return squared * squared * squared;
}

/**
 * How far a bacterium is charged beyond its normal maximum, from 0 to 1 at
 * the supercharged limit - the white heat of both looks.
 */
export function overcharge(energy: number, balance: GameBalance): number {
  const range = balance.superChargedMaxEnergy - balance.maxEnergy;
  return energy > balance.maxEnergy && range > 0
    ? Math.min(1, (energy - balance.maxEnergy) / range)
    : 0;
}

/** The density of the weakest bacterium; one at full strength has 1. */
export const MIN_CELL_DENSITY = 0.55;

/** How dense a bacterium of this strength makes its cell. */
export function cellDensity(strength: number): number {
  return MIN_CELL_DENSITY + (1 - MIN_CELL_DENSITY) * Math.min(1, strength);
}

/** A bacterium's energy relative to the normal maximum, never below 0. */
export function strengthOf(energy: number, balance: GameBalance): number {
  return Math.max(energy, 0) / balance.maxEnergy;
}

/** True for the few pixels that glint in this tenth of a second. */
export function sparkle(x: number, y: number, timeSec: number): boolean {
  return hash(x >> 1, y >> 1, Math.floor(timeSec * 10)) > 0.992;
}
