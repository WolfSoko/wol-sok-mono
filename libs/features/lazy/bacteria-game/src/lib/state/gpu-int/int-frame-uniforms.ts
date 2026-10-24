import { WEAPON_EFFECTS } from '../evolution';
import { ZONE_EFFECTS } from '../zones';
import { chanceThreshold, toQ14, toTarget } from './fixed-point';

/** The most colonies the GPU simulation runs - `MAX_GPU_COLONIES`. */
export const INT_COLONIES = 4;

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
