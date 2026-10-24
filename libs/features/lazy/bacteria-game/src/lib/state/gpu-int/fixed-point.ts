/**
 * The fixed point formats of the deterministic GPU simulation (ADR 0015),
 * and the CPU side conversions from the float balance values into them.
 *
 * The conversions run on the CPU in JS doubles, which are correctly rounded
 * IEEE 754 everywhere, so every device and the server get the same integers.
 * The shaders and the TypeScript reference then only ever see integers.
 *
 * Every value that feeds the state has a bound below 2^31 (GLSL ES 3.00 has
 * no 64 bit multiply): the `*_MAX` constants here name them, and
 * {@link mulQ14} documents what its operands may be.
 */

/** Q14: 1 is `1 << 14`. Energy, directions, aggression and shares use it. */
export const Q14 = 14;
export const ONE_Q14 = 1 << Q14;

/**
 * The largest Q14 value the state holds: energy is stored in the 16 bit
 * green channel (`ENERGY_SCALE` is the same 2^14), so 65535 / 16384, just
 * under 4.
 */
export const Q14_STATE_MAX = 0xffff;

/** A draw's top 14 bits as a Q14 fraction: `draw >>> 18`. */
export const Q14_DRAW_SHIFT = 32 - Q14;

/** Crosshairs are kept in sixteenths of a cell. */
export const TARGET_SHIFT = 4;

/**
 * The largest crosshair coordinate either way: the grid's longest side
 * (well under 2048 cells) in sixteenths. A crosshair may lie off the grid,
 * so targets are signed.
 */
export const TARGET_MAX = 2048 << TARGET_SHIFT;

/** A fraction 0..1 as Q14, rounded to the nearest; NaN counts as 0. */
export function toQ14(value: number): number {
  return value > 0 ? Math.round(Math.min(1, value) * ONE_Q14) : 0;
}

/**
 * A non-negative value as Q14, rounded to the nearest and capped at
 * {@link Q14_STATE_MAX} - energies and other amounts that may pass 1. NaN
 * counts as 0.
 */
export function toUnsignedQ14(value: number): number {
  return value > 0 ? Math.min(Q14_STATE_MAX, Math.round(value * ONE_Q14)) : 0;
}

/**
 * A chance 0..1 as a threshold for a 32 bit draw: `draw < threshold` holds
 * with the chance, to 2^-32. A chance of 1 maps to 2^32 - 1 and misses one
 * draw in 2^32, which keeps the threshold a uint.
 */
export function chanceThreshold(chance: number): number {
  if (!(chance > 0)) {
    return 0;
  }
  if (chance >= 1) {
    return 0xffffffff;
  }
  return Math.floor(chance * 4294967296) >>> 0;
}

/**
 * A crosshair position in cells as sixteenths, rounded and kept within
 * {@link TARGET_MAX} either way; NaN counts as 0.
 */
export function toTarget(cells: number): number {
  if (Number.isNaN(cells)) {
    return 0;
  }
  const target = Math.round(cells * (1 << TARGET_SHIFT));
  return Math.max(-TARGET_MAX, Math.min(TARGET_MAX, target));
}

/**
 * `a * b` in Q14, rounded towards minus infinity by an arithmetic right
 * shift - the same as `(a * b) >> 14` on `int` in GLSL. The product must
 * stay below 2^31 in magnitude: two values up to {@link Q14_STATE_MAX}
 * (65535^2 is about 2^32) do not fit, so one operand has to be a share
 * (at most `ONE_Q14`) or both have to be below 2^15.
 */
export function mulQ14(a: number, b: number): number {
  return Math.imul(a, b) >> Q14;
}
