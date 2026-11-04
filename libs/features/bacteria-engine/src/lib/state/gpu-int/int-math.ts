import { ONE_Q14 } from './fixed-point';

/**
 * Integer helpers of the deterministic GPU simulation (ADR 0015) that the
 * shaders (`gl/int-common.ts`) compute the same way.
 */

/** floor(sqrt(n)) of a uint, bit by bit - exact, as `isqrt` in GLSL. */
export function isqrt(value: number): number {
  let n = value >>> 0;
  let result = 0;
  let bit = 1 << 30;
  while (bit > n) {
    bit >>>= 2;
  }
  while (bit !== 0) {
    if (n >= result + bit) {
      n -= result + bit;
      result = (result >>> 1) + bit;
    } else {
      result >>>= 1;
    }
    bit >>>= 2;
  }
  return result;
}

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
  while (Math.max(ax, ay) >= 32768) {
    ax >>>= 1;
    ay >>>= 1;
  }
  while (Math.max(ax, ay) < 16384) {
    ax <<= 1;
    ay <<= 1;
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
