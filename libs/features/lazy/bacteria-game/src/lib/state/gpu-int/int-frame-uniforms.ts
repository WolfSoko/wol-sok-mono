import { WEAPON_EFFECTS } from '../evolution';
import { TICK_SEC } from '../fixed-tick';
import { ZONE_EFFECTS } from '../zones';
import { chanceThreshold, ONE_Q14, toQ14, toTarget } from './fixed-point';

/** The most colonies the GPU simulation runs - `MAX_GPU_COLONIES`. */
export const INT_COLONIES = 4;

/** The most nutrient pellets the shaders take - `MAX_PELLETS`. */
export const INT_PELLETS = 16;

/**
 * The fractional bits of a colony's combat drain per step and point of
 * pressure ({@link IntFrameUniforms.drain}): 18, finer than Q14, as the
 * drain of one step is a few hundredths.
 */
export const DRAIN_SHIFT = 18;

/**
 * The most a colony's attack may be, Q14: 16 times a plain colony's. It
 * keeps a hit (attack times an energy of at most 2^15) below 2^19, eight
 * of them below 2^22, and the pressure they make below 2^23 - inside what
 * `mulShr` takes.
 */
export const INT_ATTACK_MAX = 16 * ONE_Q14;

/**
 * The most a colony's drain may be: 2^15 in {@link DRAIN_SHIFT} bits, an
 * eighth of an energy per point of pressure and step - more than 4 times a
 * plain colony's toughness. `mulShr` takes no more.
 */
export const INT_DRAIN_MAX = 1 << 15;

/**
 * The divide chances a colony has in one frame, one per mix of what lies
 * under a bacterium: agar ground (bit 0), its own agar bloom (bit 1) and an
 * enemy's cryo pulse (bit 2). Each is the chance with its factors already
 * multiplied in and capped by the colony's budget, as a draw threshold - so
 * the shader only picks one and compares, and no product is left to it.
 */
export const DIVIDE_VARIANTS = 8;

/** Which of the {@link DIVIDE_VARIANTS} a bacterium divides with. */
export function divideVariant(
  agar: boolean,
  bloom: boolean,
  cryo: boolean
): number {
  return (agar ? 1 : 0) | (bloom ? 2 : 0) | (cryo ? 4 : 0);
}

/**
 * The per frame uniforms of the integer claim and apply passes (ADR 0015,
 * step 2), filled in place each frame.
 */
export interface IntFrameUniforms {
  /** The crosshairs, x and y per colony, in sixteenths of a cell. */
  targets: Int32Array;
  /** Q14 per colony. */
  aggression: Int32Array;
  /** Draw thresholds, {@link DIVIDE_VARIANTS} per colony. */
  divideChance: Uint32Array;
  /** Q14 per colony, at most {@link INT_ATTACK_MAX}. */
  attack: Int32Array;
  /**
   * The energy a bacterium of the colony loses per step and point of
   * pressure - its toughness times the combat drain over one step - in
   * {@link DRAIN_SHIFT} fractional bits, at most {@link INT_DRAIN_MAX}.
   */
  drain: Int32Array;
  /** Per pellet: its cell's x and y, and 1 while it is not eaten up. */
  pellets: Int32Array;
  /** How many of the pellets count. */
  pelletCount: number;
}

/** What the float passes take per frame - see `GpuSimulation`. */
export interface FloatFrameUniforms {
  /** In cells, NaN for a colony that aims at nothing. */
  targets: ArrayLike<number>;
  aggression: ArrayLike<number>;
  /** Per bacterium on plain ground, this frame. */
  divideChance: ArrayLike<number>;
  /** The most a bacterium of the colony may divide with anywhere. */
  divideBudget: ArrayLike<number>;
}

export function createIntFrameUniforms(): IntFrameUniforms {
  return {
    targets: new Int32Array(INT_COLONIES * 2),
    aggression: new Int32Array(INT_COLONIES),
    divideChance: new Uint32Array(INT_COLONIES * DIVIDE_VARIANTS),
    attack: new Int32Array(INT_COLONIES),
    drain: new Int32Array(INT_COLONIES),
    pellets: new Int32Array(INT_PELLETS * 3),
    pelletCount: 0,
  };
}

/**
 * Converts the float frame uniforms into the integer ones, on the CPU,
 * where doubles round the same on every device. The inputs are taken as
 * 32 bit floats (`Math.fround`), as `GpuSimulation` holds them, so a caller
 * with doubles - the reference, the server - gets the same integers.
 */
export function fillIntFrameUniforms(
  into: IntFrameUniforms,
  from: FloatFrameUniforms
): IntFrameUniforms {
  for (let slot = 0; slot < INT_COLONIES; slot++) {
    // No crosshair (NaN) is 0: its colony does not move anyway.
    const f32 = Math.fround;
    into.targets[slot * 2] = toTarget(f32(from.targets[slot * 2]));
    into.targets[slot * 2 + 1] = toTarget(f32(from.targets[slot * 2 + 1]));
    into.aggression[slot] = toQ14(f32(from.aggression[slot]));
    const chance = f32(from.divideChance[slot]);
    const budget = f32(from.divideBudget[slot]);
    for (let variant = 0; variant < DIVIDE_VARIANTS; variant++) {
      const factor =
        (variant & 1 ? ZONE_EFFECTS.agarDivideFactor : 1) *
        (variant & 2 ? WEAPON_EFFECTS.agarBloomDivideFactor : 1) *
        (variant & 4 ? WEAPON_EFFECTS.cryoDivideFactor : 1);
      into.divideChance[slot * DIVIDE_VARIANTS + variant] = chanceThreshold(
        Math.min(budget, chance * factor)
      );
    }
  }
  return into;
}

/** What the float combat pass takes per frame - see `GpuSimulation`. */
export interface FloatCombatUniforms {
  attack: ArrayLike<number>;
  /** Times the pressure on the colony. */
  toughness: ArrayLike<number>;
  /** Per pellet: x and y in cells, and 1 while it is not eaten up. */
  pellets: ArrayLike<number>;
}

/**
 * Converts the combat's share of the frame uniforms, on the CPU: the
 * attacks as Q14, the drains as {@link DRAIN_SHIFT} bits of energy per step
 * of `TICK_SEC` and point of pressure, and the pellets' cells as the float
 * pass reads them (truncated). The inputs are taken as 32 bit floats, as
 * {@link fillIntFrameUniforms} takes its own.
 */
export function fillIntCombatUniforms(
  into: IntFrameUniforms,
  from: FloatCombatUniforms,
  combatDrainPerSec: number,
  pelletCount: number
): IntFrameUniforms {
  const f32 = Math.fround;
  for (let slot = 0; slot < INT_COLONIES; slot++) {
    const attack = f32(from.attack[slot]);
    into.attack[slot] =
      attack > 0 ? Math.min(INT_ATTACK_MAX, Math.round(attack * ONE_Q14)) : 0;
    const drain = f32(from.toughness[slot]) * combatDrainPerSec * TICK_SEC;
    into.drain[slot] =
      drain > 0
        ? Math.min(INT_DRAIN_MAX, Math.round(drain * 2 ** DRAIN_SHIFT))
        : 0;
  }
  into.pelletCount = Math.min(INT_PELLETS, Math.max(0, pelletCount));
  for (let i = 0; i < INT_PELLETS * 3; i++) {
    const value = f32(from.pellets[i]);
    into.pellets[i] = value > 0 ? Math.trunc(value) : 0;
  }
  return into;
}
