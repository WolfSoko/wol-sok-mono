import { distance } from '../geometry';
import { DynamicWall, Rect } from '../maps';

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

/** A round wall that is part of a living, moving layout. */
export function movingBlob(x: number, y: number, radius: number): DynamicWall {
  const wall = blob(x, y, radius) as DynamicWall;
  wall.solid = true;
  wall.warning = 0;
  return wall;
}

/** True when a blob there would reach into one of the two start spots. */
export function nearSpawn(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number
): boolean {
  return spawnSpots(width, height).some(
    (spawn) => distance({ x, y }, spawn) < SPAWN_CLEARANCE + radius
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
