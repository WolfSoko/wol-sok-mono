/**
 * Pure helpers for steering the crosshairs with a finger or a mouse.
 *
 * They are kept free of Angular and the DOM so the coordinate maths and the
 * pointer-to-player assignment can be tested on their own.
 */

import { clamp, Point } from './state/geometry';

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
    const distance = Math.hypot(crosshair.x - point.x, crosshair.y - point.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = crosshair.id;
    }
  }

  return nearest;
}

/**
 * Where a joystick is pushed: each axis -1..1, the vector never longer than 1.
 * The zero vector means the stick is at rest.
 */
export interface SteeringVector {
  x: number;
  y: number;
}

export const NO_STEERING: SteeringVector = { x: 0, y: 0 };

/** True while the stick is pushed at all. */
export function isSteering(vector: SteeringVector): boolean {
  return vector.x !== 0 || vector.y !== 0;
}

/**
 * Turns the finger's offset from where it first touched down into a steering
 * vector.
 *
 * Inside the dead zone the stick counts as centred, so a resting finger does
 * not drift the crosshair. From there the deflection grows linearly and is
 * pushed all the way at `radius` - a small nudge gives fine control, a long
 * pull full speed.
 */
export function steeringVector(
  origin: Point,
  pointer: Point,
  radius: number,
  deadZone = 0.15
): SteeringVector {
  const dX = pointer.x - origin.x;
  const dY = pointer.y - origin.y;
  const distance = Math.hypot(dX, dY);
  if (distance === 0 || radius <= 0) {
    return { ...NO_STEERING };
  }
  const deflection = distance / radius;
  if (deflection <= deadZone) {
    return { ...NO_STEERING };
  }
  const strength = Math.min(1, (deflection - deadZone) / (1 - deadZone));
  return { x: (dX / distance) * strength, y: (dY / distance) * strength };
}

/**
 * Where the knob is drawn relative to the base of the stick: under the finger,
 * but never further out than the rim of the base.
 */
export function knobOffset(
  origin: Point,
  pointer: Point,
  radius: number
): Point {
  const dX = pointer.x - origin.x;
  const dY = pointer.y - origin.y;
  const distance = Math.hypot(dX, dY);
  if (distance <= radius || distance === 0) {
    return { x: dX, y: dY };
  }
  return { x: (dX / distance) * radius, y: (dY / distance) * radius };
}
