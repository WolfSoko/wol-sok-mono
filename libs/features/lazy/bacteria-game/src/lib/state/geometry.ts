/** The cells a colony covers, inclusive, in arena cells. */
export interface CellBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A position in arena pixels. */
export interface Point {
  x: number;
  y: number;
}

/** `value` limited to the closed range `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** `value` wrapped into `[0, size)`, also for negative values. */
export function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** The length of a vector. */
export function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

/** Straight line distance between two points. */
export function distance(a: Point, b: Point): number {
  return length(delta(a, b));
}

/** The vector from `from` to `to`. */
export function delta(from: Point, to: Point): Point {
  return { x: to.x - from.x, y: to.y - from.y };
}

/** The vector scaled to the given length; the zero vector stays zero. */
export function scaleTo(vector: Point, to: number): Point {
  const current = length(vector);
  if (current === 0) {
    return { x: 0, y: 0 };
  }
  return { x: (vector.x / current) * to, y: (vector.y / current) * to };
}

/** The vector, shortened to `max` when it is longer than that. */
export function clampLength(vector: Point, max: number): Point {
  return length(vector) > max
    ? scaleTo(vector, max)
    : { x: vector.x, y: vector.y };
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
