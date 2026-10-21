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
import { Rect } from './state/maps';

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
 * width by CSS, so the two coordinate systems differ by a scale factor. It
 * shows `view` of the arena - all of it, but on a map the camera follows
 * over - and a pointer off the canvas is kept on its edge. Returns null
 * while the element has no layout yet.
 */
export function arenaPointFromClient(
  clientX: number,
  clientY: number,
  bounds: ElementBounds,
  view: Rect
): ArenaPoint | null {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return null;
  }
  return {
    x:
      view.x + clamp((clientX - bounds.left) / bounds.width, 0, 1) * view.width,
    y:
      view.y +
      clamp((clientY - bounds.top) / bounds.height, 0, 1) * view.height,
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

/**
 * The fingers on the arena, in client pixels, so a second finger that has
 * no crosshair left to grab can pinch the camera with the first. Client
 * pixels, not cells: the cells under a finger change as the camera zooms.
 *
 * A finger stays in its pinch until it is lifted - the one left on the
 * screen does not grab a crosshair halfway through a gesture.
 */
export class Pinch {
  private readonly fingers = new Map<number, Point>();
  private pair: readonly [number, number] | null = null;

  public down(pointerId: number, point: Point): void {
    this.fingers.set(pointerId, point);
  }

  /**
   * Pinches with `pointerId` and the one other finger on the arena -
   * false, and no pinch, unless there are exactly two.
   */
  public start(pointerId: number): boolean {
    const other = [...this.fingers.keys()].find((id) => id !== pointerId);
    if (this.fingers.size !== 2 || other == null) {
      return false;
    }
    this.pair = [other, pointerId];
    return true;
  }

  public pinches(pointerId: number): boolean {
    return this.pair?.includes(pointerId) ?? false;
  }

  /**
   * Moves a finger and returns by how much the gap between the two
   * pinching grew since its last move: the factor to zoom by, 1 while the
   * finger does not pinch.
   */
  public move(pointerId: number, point: Point): number {
    if (!this.fingers.has(pointerId)) {
      return 1;
    }
    const before = this.gap();
    this.fingers.set(pointerId, point);
    const after = this.gap();
    return this.pinches(pointerId) && before > 0 && after > 0
      ? after / before
      : 1;
  }

  public up(pointerId: number): void {
    this.fingers.delete(pointerId);
    if (this.pair != null && !this.pair.some((id) => this.fingers.has(id))) {
      this.pair = null;
    }
  }

  private gap(): number {
    if (this.pair == null) {
      return 0;
    }
    const [a, b] = this.pair.map((id) => this.fingers.get(id));
    return a == null || b == null ? 0 : distance(a, b);
  }
}
