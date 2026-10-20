/**
 * The shapes the layouts are built from - round walls, a lattice of them,
 * threads of them - and where the colonies start, which no layout may wall
 * in. The hand-made organic maps and the level generator both use them.
 */

import { Rect } from './maps';

/**
 * How far a wall stays from where a colony starts: the largest start radius
 * any level uses, plus a few cells of air.
 */
export const SPAWN_CLEARANCE = 20;

/** Where the two colonies start on an arena of that size. */
export function spawnSpots(
  width: number,
  height: number
): [{ x: number; y: number }, { x: number; y: number }] {
  return [
    { x: width / 4, y: height / 2 },
    { x: (width * 3) / 4, y: height / 2 },
  ];
}

/** A round wall around a point, on whole cells so its mirror image is exact. */
export function blob(x: number, y: number, radius: number): Rect {
  const r = Math.max(1, Math.round(radius));
  return {
    x: Math.round(x) - r,
    y: Math.round(y) - r,
    width: 2 * r,
    height: 2 * r,
    round: true,
  };
}

/** True when a blob there would reach into one of the two start spots. */
export function nearSpawn(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number
): boolean {
  const reach = SPAWN_CLEARANCE + radius;
  const dy = y - height / 2;
  return (
    Math.hypot(x - width / 4, dy) < reach ||
    Math.hypot(x - (width * 3) / 4, dy) < reach
  );
}

/** True when the rect comes closer to a start spot than the clearance. */
export function rectNearSpawn(
  rect: Rect,
  width: number,
  height: number
): boolean {
  return spawnSpots(width, height).some((spawn) => {
    const dx = Math.max(rect.x - spawn.x, 0, spawn.x - (rect.x + rect.width));
    const dy = Math.max(rect.y - spawn.y, 0, spawn.y - (rect.y + rect.height));
    return Math.hypot(dx, dy) < SPAWN_CLEARANCE;
  });
}

/** How a lattice of round walls is laid out - see {@link hexLattice}. */
export interface LatticeShape {
  /** Distance between two neighbours of the lattice. */
  spacing: number;
  /** How far a blob is shaken off its spot, as a share of the spacing. */
  jitter: number;
  /** A blob's radius as a share of the spacing: `fill` plus up to `spread`. */
  fill: number;
  spread: number;
  /** The chance a spot of the lattice stays empty. */
  skip?: number;
}

/**
 * Blobs on a shaken hexagonal lattice over the left half of the arena, kept
 * out of the start spots - packed like the air sacs of a lung.
 */
export function hexLattice(
  random: () => number,
  width: number,
  height: number,
  { spacing, jitter, fill, spread, skip = 0 }: LatticeShape
): Rect[] {
  const blobs: Rect[] = [];
  for (let row = 0; row * spacing * 0.87 < height + spacing; row++) {
    const y = row * spacing * 0.87;
    for (let x = (row % 2) * (spacing / 2); x < width / 2; x += spacing) {
      if (skip > 0 && random() < skip) {
        continue;
      }
      const cx = x + (random() - 0.5) * spacing * jitter;
      const cy = y + (random() - 0.5) * spacing * jitter;
      const radius = spacing * (fill + random() * spread);
      if (!nearSpawn(cx, cy, radius, width, height)) {
        blobs.push(blob(cx, cy, radius));
      }
    }
  }
  return blobs;
}

/** Where a thread starts growing and how - see {@link growThread}. */
export interface ThreadStart {
  x: number;
  y: number;
  angle: number;
  radius: number;
  length: number;
}

/**
 * A fungal thread of blobs that grows from a point, wanders, tapers, may
 * branch once, and stops short of the start spots - pushed onto `walls`.
 */
export function growThread(
  random: () => number,
  walls: Rect[],
  width: number,
  height: number,
  start: ThreadStart,
  canBranch = true
): void {
  let { x, y, angle } = start;
  const { radius, length } = start;
  const branchAt = length * (0.35 + random() * 0.2);
  for (let travelled = 0; travelled < length; travelled += 3) {
    const taper = 1 - (travelled / length) * 0.6;
    if (nearSpawn(x, y, radius * taper, width, height)) {
      return;
    }
    walls.push(blob(x, y, Math.max(2, radius * taper)));
    if (canBranch && travelled >= branchAt) {
      canBranch = false;
      const side = random() < 0.5 ? -1 : 1;
      growThread(
        random,
        walls,
        width,
        height,
        {
          x,
          y,
          angle: angle + side * (0.7 + random() * 0.4),
          radius: radius * taper * 0.8,
          length: (length - travelled) * 0.7,
        },
        false
      );
    }
    // Wander, but keep growing away from the edge.
    angle += (random() - 0.5) * 0.5;
    angle += (Math.PI / 2 - angle) * 0.08;
    x += Math.cos(angle) * 3;
    y += Math.sin(angle) * 3;
  }
}
