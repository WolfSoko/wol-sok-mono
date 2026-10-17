/**
 * Pure helpers for steering the crosshairs with a finger or a mouse.
 *
 * They are kept free of Angular and the DOM so the coordinate maths and the
 * pointer-to-player assignment can be tested on their own.
 */

import {
  clamp,
  clampLength,
  delta,
  distance,
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
    const distance = Math.hypot(crosshair.x - point.x, crosshair.y - point.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = crosshair.id;
    }
  }

  return nearest;
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
  if (radius <= 0 || deadZone >= 1) {
    return NO_STEERING;
  }
  const deflection = distance(origin, pointer) / radius;
  if (deflection <= deadZone) {
    return NO_STEERING;
  }
  const strength = Math.min(1, (deflection - deadZone) / (1 - deadZone));
  return scaleTo(delta(origin, pointer), strength);
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
  return clampLength(delta(origin, pointer), radius);
}

/** How far a seat is turned on the screen: clockwise, in degrees. */
export type Turn = 0 | 90 | 180 | 270;

/**
 * Which way a player's seat is turned so that they can read it.
 *
 * Alone, the seat is laid out like the screen. Two players sit at opposite
 * short edges of the phone: on a phone lying across between them (landscape)
 * seat 0 is at the left edge and seat 1 at the right edge, each turned a
 * quarter towards its player; on an upright phone (portrait) seat 1 is along
 * the top edge, upside down for the player sitting there.
 */
export function seatTurn(seat: number, seats: number, portrait: boolean): Turn {
  if (seats < 2) {
    return 0;
  }
  if (portrait) {
    return seat === 0 ? 0 : 180;
  }
  return seat === 0 ? 90 : 270;
}

/** The turn that undoes `turn`. */
export function turnBack(turn: Turn): Turn {
  return ((360 - turn) % 360) as Turn;
}

/** Rotates a vector by a quarter turn clockwise, in screen space (y down). */
export function turnPoint(point: Point, turn: Turn): Point {
  switch (turn) {
    case 90:
      return { x: -point.y, y: point.x };
    case 180:
      return { x: -point.x, y: -point.y };
    case 270:
      return { x: point.y, y: -point.x };
    default:
      return point;
  }
}

/**
 * The size of a turned element in its own coordinates. `bounds` is the box
 * around it on the screen, which has width and height swapped after a
 * quarter turn.
 */
function turnedSize(bounds: ElementBounds, turn: Turn): Point {
  return turn === 90 || turn === 270
    ? { x: bounds.height, y: bounds.width }
    : { x: bounds.width, y: bounds.height };
}

/**
 * Where a client point lies inside an element that is turned on the screen,
 * in the element's own coordinates: measured from the centre, which the turn
 * leaves where it is, and turned back.
 */
export function elementPointFromClient(
  client: Point,
  bounds: ElementBounds,
  turn: Turn
): Point {
  const centre = {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
  const size = turnedSize(bounds, turn);
  const offset = turnPoint(delta(centre, client), turnBack(turn));
  return { x: size.x / 2 + offset.x, y: size.y / 2 + offset.y };
}

/** The client point of a point inside a turned element; see {@link elementPointFromClient}. */
export function clientPointFromElement(
  point: Point,
  bounds: ElementBounds,
  turn: Turn
): Point {
  const size = turnedSize(bounds, turn);
  const offset = turnPoint(
    { x: point.x - size.x / 2, y: point.y - size.y / 2 },
    turn
  );
  return {
    x: bounds.left + bounds.width / 2 + offset.x,
    y: bounds.top + bounds.height / 2 + offset.y,
  };
}
