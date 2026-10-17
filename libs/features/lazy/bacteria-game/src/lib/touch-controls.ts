/**
 * Pure helpers for steering the crosshairs with a finger or a mouse.
 *
 * They are kept free of Angular and the DOM so the coordinate maths and the
 * pointer-to-player assignment can be tested on their own.
 */

import {
  clamp,
  distance,
  length,
  NO_STEERING,
  Point,
  scaleTo,
  SteeringVector,
} from './state/geometry';

export type ArenaPoint = Point;

/** The part of a DOMRect these helpers need. */
export interface ElementBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The part of a Player these helpers need. */
export interface CrosshairPosition {
  id: number;
  x: number;
  y: number;
}

/**
 * Converts a pointer position in client (CSS pixel) coordinates into arena
 * coordinates.
 *
 * The canvas is rendered at its intrinsic size but stretched to the container
 * width by CSS, so the two coordinate systems differ by a scale factor.
 * Returns null while the element has no layout yet.
 */
export function arenaPointFromClient(
  clientX: number,
  clientY: number,
  bounds: ElementBounds,
  arenaWidth: number,
  arenaHeight: number
): ArenaPoint | null {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }
  return {
    x: clamp(
      ((clientX - bounds.left) / bounds.width) * arenaWidth,
      0,
      arenaWidth
    ),
    y: clamp(
      ((clientY - bounds.top) / bounds.height) * arenaHeight,
      0,
      arenaHeight
    ),
  };
}

/**
 * Picks the crosshair a new pointer should grab: the closest one that no other
 * pointer is already holding. That way the first finger takes the crosshair it
 * lands next to and the second finger necessarily gets the other one, so two
 * players can share one screen.
 *
 * Returns null when every crosshair is already taken.
 */
export function nearestFreeCrosshair(
  crosshairs: readonly CrosshairPosition[],
  point: ArenaPoint,
  taken: ReadonlySet<number>
): number | null {
  let nearest: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const crosshair of crosshairs) {
    if (taken.has(crosshair.id)) {
      continue;
    }
    const gap = distance(crosshair, point);
    if (gap < nearestDistance) {
      nearestDistance = gap;
      nearest = crosshair.id;
    }
  }

  return nearest;
}

/**
 * Turns the finger's offset from where it first touched down - the push - into
 * a steering vector.
 *
 * Inside the dead zone the stick counts as centred, so a resting finger does
 * not drift the crosshair. From there the deflection grows linearly and is
 * pushed all the way at `radius` - a small nudge gives fine control, a long
 * pull full speed.
 */
export function steeringVector(
  push: Point,
  radius: number,
  deadZone = 0.15
): SteeringVector {
  if (radius <= 0 || deadZone >= 1) {
    return NO_STEERING;
  }
  const deflection = length(push) / radius;
  if (deflection <= deadZone) {
    return NO_STEERING;
  }
  const strength = Math.min(1, (deflection - deadZone) / (1 - deadZone));
  return scaleTo(push, strength);
}
