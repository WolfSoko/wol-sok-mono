import { ONE_Q14 } from './fixed-point';

/**
 * Integer helpers of the deterministic GPU simulation (ADR 0015) that the
 * shaders (`gl/int-common.ts`) compute the same way.
 */

/**
 * floor(sqrt(n)) of a uint, exact, as `isqrt` in GLSL, which works it out
 * bit by bit. A double's square root is correctly rounded, so below 2^52 it
 * never rounds up to the next integer and its floor is exact.
 */
export function isqrt(value: number): number {
  return Math.floor(Math.sqrt(value >>> 0));
}

/** The bit length the longer axis is scaled to: [2^14, 2^15). */
const UNIT_SCALE_BITS = 15;

/**
 * The direction of `(vx, vy)` as a Q14 unit vector, rounded to the nearest
 * per axis, as `unitQ14` in GLSL; (0, 0) for none. The vector is first
 * scaled by powers of two until its longer axis lies in [2^14, 2^15), which
 * keeps the squared length below 2^31 and the precision the same for short
 * and long vectors. Each component must be an integer below 2^30 in
 * magnitude, as the shader's `ivec2` is; anything else throws, since the
 * scaling would never end on a fraction.
 */
export function unitQ14(vx: number, vy: number, out: Int32Array): Int32Array {
  if (!isSmallInt(vx) || !isSmallInt(vy)) {
    throw new RangeError(`unitQ14 takes integers below 2^30: ${vx}, ${vy}`);
  }
  if (vx === 0 && vy === 0) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  let ax = Math.abs(vx);
  let ay = Math.abs(vy);
  // All the halvings or doublings of the shader's loops in one shift: each
  // halving floors, and floors of halvings compose.
  const shift = UNIT_SCALE_BITS - (32 - Math.clz32(Math.max(ax, ay)));
  if (shift < 0) {
    ax >>>= -shift;
    ay >>>= -shift;
  } else {
    ax <<= shift;
    ay <<= shift;
  }
  const length = isqrt(ax * ax + ay * ay);
  const half = length >>> 1;
  out[0] = Math.sign(vx) * Math.floor((ax * ONE_Q14 + half) / length);
  out[1] = Math.sign(vy) * Math.floor((ay * ONE_Q14 + half) / length);
  return out;
}

function isSmallInt(value: number): boolean {
  return Number.isInteger(value) && Math.abs(value) < 2 ** 30;
}
