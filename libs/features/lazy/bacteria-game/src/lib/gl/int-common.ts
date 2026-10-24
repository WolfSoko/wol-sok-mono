import { chanceThreshold, ONE_Q14, Q14 } from '../state/gpu-int/fixed-point';
import { SALT_SPREAD, STEP_SALT_STRIDE } from '../state/gpu-int/draws';

/**
 * The GLSL twin of `state/gpu-int/` (ADR 0015): the draws, the Q14 product,
 * the integer square root and the unit vector, for the deterministic
 * shaders to include after their uniforms. It expects a `uint uSeed` uniform,
 * the frame seed of `frameSeed`.
 *
 * GLSL ES 3.00 requires highp int and uint in fragment shaders to be exact
 * 32 bit two's complement, wrapping on overflow, with `>>` on an int
 * extending the sign. These functions rely on nothing else: no float, and
 * division only on unsigned operands, since signed division by a negative
 * is left to the implementation.
 */
export const INT_COMMON = `
const int Q14 = ${Q14};
const int ONE_Q14 = ${ONE_Q14};
const uint SALT_SPREAD = ${SALT_SPREAD}u;
const uint STEP_SALT_STRIDE = ${STEP_SALT_STRIDE}u;

uint pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v.x ^ v.y ^ v.z;
}

/** The 32 bit draw of a cell for this frame and a purpose. */
uint drawAt(ivec2 cell, uint salt) {
  return pcg3d(uvec3(uvec2(cell), uSeed ^ (salt * SALT_SPREAD)));
}

uint intStepSalt(uint salt, int step) {
  return salt + uint(step) * STEP_SALT_STRIDE;
}

/** True with the chance a threshold of \`chanceThreshold\` stands for. */
bool chanceAt(ivec2 cell, uint salt, uint threshold) {
  return drawAt(cell, salt) < threshold;
}

/** a * b in Q14, rounded towards minus infinity - see mulQ14. */
int mulQ14(int a, int b) {
  return (a * b) >> Q14;
}

/** floor(sqrt(n)), bit by bit - exact. */
uint isqrt(uint n) {
  uint result = 0u;
  uint bit = 1u << 30u;
  for (int i = 0; i < 16; i++) {
    if (bit > n) {
      bit >>= 2u;
    }
  }
  for (int i = 0; i < 16; i++) {
    if (bit == 0u) {
      break;
    }
    if (n >= result + bit) {
      n -= result + bit;
      result = (result >> 1u) + bit;
    } else {
      result >>= 1u;
    }
    bit >>= 2u;
  }
  return result;
}

/** v as a Q14 unit vector, rounded per axis - (0, 0) stays (0, 0). */
ivec2 unitQ14(ivec2 v) {
  if (v == ivec2(0)) {
    return ivec2(0);
  }
  uint ax = uint(abs(v.x));
  uint ay = uint(abs(v.y));
  for (int i = 0; i < 17; i++) {
    if (max(ax, ay) >= 32768u) {
      ax >>= 1u;
      ay >>= 1u;
    }
  }
  for (int i = 0; i < 15; i++) {
    if (max(ax, ay) < 16384u) {
      ax <<= 1u;
      ay <<= 1u;
    }
  }
  uint len = isqrt(ax * ax + ay * ay); // in [2^14, 46341)
  uint ux = (ax * uint(ONE_Q14) + (len >> 1u)) / len; // ax < 2^15: < 2^29
  uint uy = (ay * uint(ONE_Q14) + (len >> 1u)) / len;
  return ivec2(v.x < 0 ? -int(ux) : int(ux), v.y < 0 ? -int(uy) : int(uy));
}
`;

/** A chance as a GLSL uint literal, for constants baked into a shader. */
export function glslChance(chance: number): string {
  return `${chanceThreshold(chance)}u`;
}
