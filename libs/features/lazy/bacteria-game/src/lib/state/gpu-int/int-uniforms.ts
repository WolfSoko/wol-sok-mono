import { WEAPON_EFFECTS } from '../evolution';
import { GameBalance } from '../game-balance';
import { ZONE_EFFECTS } from '../zones';
import { chanceThreshold, toQ14, toUnsignedQ14 } from './fixed-point';

/**
 * The balance values the deterministic GPU simulation reads for a whole
 * match, converted once on the CPU (ADR 0015, decision 1): shares and
 * energies as Q14, chances as thresholds for a 32 bit draw. The per second
 * rates (regeneration, drain, decay) follow with the fixed point combat in
 * a later step of the rollout, together with the fixed step length they
 * are multiplied with.
 */
export interface IntMatchUniforms {
  /** Q14, at most 1. */
  jitter: number;
  /** Q14 energy. */
  divideThreshold: number;
  /** Q14, at most 1. */
  parentShare: number;
  /** Q14 energy. */
  maxEnergy: number;
  /** Q14 energy, below 4. */
  superMaxEnergy: number;
  /** Q14 energy. */
  captureEnergy: number;
  /** Draw threshold. */
  consumeChance: number;
  /** Draw threshold. */
  iceStayChance: number;
  /** Draw threshold. */
  cryoStayChance: number;
  /** Draw threshold. */
  phageConvertChance: number;
  /** Q14, at most 1. */
  heatAggression: number;
  /** Q14, at most 1. */
  heatMaxAggression: number;
}

/**
 * The zone and weapon constants of the integer passes, converted once: the
 * shaders bake them in, the reference and {@link intMatchUniforms} read
 * them from here, so all three agree.
 */
export const INT_EFFECTS = {
  iceStayChance: chanceThreshold(ZONE_EFFECTS.iceStayChance),
  cryoStayChance: chanceThreshold(WEAPON_EFFECTS.cryoStayChance),
  phageConvertChance: chanceThreshold(WEAPON_EFFECTS.phageConvertShare),
  heatAggression: toQ14(ZONE_EFFECTS.heatAggression),
  heatMaxAggression: toQ14(ZONE_EFFECTS.heatMaxAggression),
} as const;

export function intMatchUniforms(balance: GameBalance): IntMatchUniforms {
  return {
    jitter: toQ14(balance.jitter),
    divideThreshold: toUnsignedQ14(balance.divideEnergyThreshold),
    parentShare: toQ14(balance.parentEnergyShare),
    maxEnergy: toUnsignedQ14(balance.maxEnergy),
    superMaxEnergy: toUnsignedQ14(balance.superChargedMaxEnergy),
    captureEnergy: toUnsignedQ14(balance.captureEnergy),
    consumeChance: chanceThreshold(balance.consumeChance),
    ...INT_EFFECTS,
  };
}
