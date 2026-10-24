/**
 * The random draws of the deterministic GPU simulation (ADR 0015, decision
 * 2): one contract for the shaders (`gl/int-common.ts`), the TypeScript
 * reference and the server.
 *
 * A draw hashes the cell and a salted frame seed with the PCG based 3D hash
 * of Jarzynski and Olano, in 32 bit unsigned arithmetic. It depends on the
 * cell, the frame and its purpose only, never on the order in which cells
 * are visited, so the GPU's parallel passes and a sequential port agree.
 *
 * All arithmetic is `Math.imul` and `>>> 0`, which is exactly GLSL's uint
 * arithmetic, wrapping included.
 */

/** The odd constant the salts are spread with - 2^32 / golden ratio. */
export const SALT_SPREAD = 0x9e3779b1;

/** How far apart the movement steps of one frame keep their salts. */
export const STEP_SALT_STRIDE = 97;

/**
 * The purpose of each draw. A pass names its salts here, so two passes
 * never share one by accident. The values are the GPU simulation's own,
 * kept so the switch to integers changes no more than it has to.
 */
export const SALT = {
  moveJitterX: 1,
  moveJitterY: 2,
  moveOctant: 3,
  moveAxisFirst: 4,
  moveFallback: 5,
  iceStay: 6,
  cryoStay: 7,
  escapeWall: 11,
  divideChance: 21,
  divideSpot: 22,
  claimPriority: 31,
  consume: 41,
  phageConvert: 43,
} as const;

/** The salt of a movement step: `salt + step * 97`, as `stepSalt` in GLSL. */
export function stepSalt(salt: number, step: number): number {
  return (salt + Math.imul(step, STEP_SALT_STRIDE)) >>> 0;
}

/** The PCG3D hash of three uints, as `pcg(uvec3)` in GLSL. */
export function pcg3d(x0: number, y0: number, z0: number): number {
  let x = (Math.imul(x0, 1664525) + 1013904223) >>> 0;
  let y = (Math.imul(y0, 1664525) + 1013904223) >>> 0;
  let z = (Math.imul(z0, 1664525) + 1013904223) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  y = (y ^ (y >>> 16)) >>> 0;
  z = (z ^ (z >>> 16)) >>> 0;
  x = (x + Math.imul(y, z)) >>> 0;
  y = (y + Math.imul(z, x)) >>> 0;
  z = (z + Math.imul(x, y)) >>> 0;
  return (x ^ y ^ z) >>> 0;
}

/**
 * The seed of one frame: the match seed mixed with the frame's number, so
 * two matches never share their draws and no frame repeats another's.
 */
export function frameSeed(matchSeed: number, frame: number): number {
  return pcg3d(matchSeed >>> 0, frame >>> 0, SALT_SPREAD);
}

/** The 32 bit draw of a cell for a frame and a purpose. */
export function drawAt(
  x: number,
  y: number,
  seed: number,
  salt: number
): number {
  return pcg3d(x >>> 0, y >>> 0, (seed ^ Math.imul(salt, SALT_SPREAD)) >>> 0);
}
