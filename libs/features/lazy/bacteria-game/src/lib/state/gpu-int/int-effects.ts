import { TARGET_SHIFT, toTarget } from './fixed-point';

/**
 * The weapons' circles in integers (ADR 0015, step 4): what the integer
 * passes' `effectOver` (`gl/int-simulation-shaders.ts`) and the reference
 * (`int-reference.ts`) test a cell against, converted once per frame on the
 * CPU. The biofilm shield has no circle: it acts through its colony's drain.
 *
 * A circle is its centre and radius in sixteenths of a cell - the centre
 * signed, like a crosshair (`TARGET_MAX` either way). The test first drops
 * a cell outside the square around the circle, so the squares it sums are
 * at most {@link INT_EFFECT_RADIUS_MAX}^2 each: below 2^31 together. A
 * circle of radius 0 covers nothing.
 */

/** The most effects the passes take at once - `MAX_EFFECTS`. */
export const INT_MAX_EFFECTS = 4;

/** The largest radius, in sixteenths: 2^15 - 1, just under 2048 cells. */
export const INT_EFFECT_RADIUS_MAX = 0x7fff;

/** The effects of one frame, filled in place - see {@link setIntEffect}. */
export interface IntEffectUniforms {
  /** Centre x, y and radius in sixteenths, then 1 when hostile - 4 each. */
  circles: Int32Array;
  /** The weapon's code (`WEAPON_CODE`) and the owner's slot + 1 - 2 each. */
  kinds: Int32Array;
  /** How many of them act. */
  count: number;
}

export function createIntEffectUniforms(): IntEffectUniforms {
  return {
    circles: new Int32Array(INT_MAX_EFFECTS * 4),
    kinds: new Int32Array(INT_MAX_EFFECTS * 2),
    count: 0,
  };
}

/** One weapon's circle, in cells, as the game holds it. */
export interface IntEffect {
  x: number;
  y: number;
  radius: number;
  hostile: boolean;
  /** The weapon's code - `WEAPON_CODE`. */
  kind: number;
  /** The owner's slot + 1. */
  owner: number;
}

/**
 * Puts one effect in place `index`. Centre and radius are taken as 32 bit
 * floats (`Math.fround`), as the float passes hold them, so a caller with
 * doubles - the reference, the server - gets the same integers.
 */
export function setIntEffect(
  into: IntEffectUniforms,
  index: number,
  { x, y, radius, hostile, kind, owner }: IntEffect
): void {
  const f32 = Math.fround;
  const r = Math.round(f32(radius) * (1 << TARGET_SHIFT));
  into.circles[index * 4] = toTarget(f32(x));
  into.circles[index * 4 + 1] = toTarget(f32(y));
  into.circles[index * 4 + 2] = r > 0 ? Math.min(INT_EFFECT_RADIUS_MAX, r) : 0;
  into.circles[index * 4 + 3] = hostile ? 1 : 0;
  into.kinds[index * 2] = kind;
  into.kinds[index * 2 + 1] = owner;
}

/**
 * The slot + 1 of the colony whose effect of `kind` acts on the cell of a
 * bacterium of `owner` (slot + 1), 0 for none: a hostile one an enemy's,
 * any other its own - as `effectOver` in the integer shaders.
 */
export function intEffectOver(
  u: IntEffectUniforms,
  x: number,
  y: number,
  owner: number,
  kind: number
): number {
  for (let i = 0; i < Math.min(u.count, INT_MAX_EFFECTS); i++) {
    const effectOwner = u.kinds[i * 2 + 1];
    const hostile = u.circles[i * 4 + 3] !== 0;
    if (u.kinds[i * 2] !== kind || (effectOwner !== owner) !== hostile) {
      continue;
    }
    const r = u.circles[i * 4 + 2];
    if (r === 0) {
      continue;
    }
    const dx = Math.abs((x << TARGET_SHIFT) - u.circles[i * 4]);
    const dy = Math.abs((y << TARGET_SHIFT) - u.circles[i * 4 + 1]);
    if (dx > r || dy > r) {
      continue;
    }
    if (dx * dx + dy * dy <= r * r) {
      return effectOwner;
    }
  }
  return 0;
}
