/** A position in arena pixels. */
export interface Point {
  x: number;
  y: number;
}

/** `value` limited to the closed range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Straight line distance between two points. */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Where a player pushes: each axis -1..1 and the vector never longer than 1.
 * The zero vector means "not pushed". A joystick reports one directly, held
 * keys are summed into one.
 */
export interface SteeringVector {
  x: number;
  y: number;
}

export const NO_STEERING: SteeringVector = { x: 0, y: 0 };

/** True while the vector asks for any movement at all. */
export function isSteering(vector: SteeringVector): boolean {
  return vector.x !== 0 || vector.y !== 0;
}
