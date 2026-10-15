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
