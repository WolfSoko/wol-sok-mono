import { WEAPON_EFFECTS } from '../evolution';
import { TICK_SEC } from '../fixed-tick';
import { GameBalance } from '../game-balance';
import { ZONE_EFFECTS } from '../zones';
import { chanceThreshold, toQ14, toUnsignedQ14 } from './fixed-point';

/**
 * The most energy a bacterium holds in the deterministic simulation, Q14:
 * 2. The combat's products take an energy of at most 2^15 (see `mulShr`),
 * so the ceilings and the capture energy are capped here, and no pass
 * writes more.
 */
export const INT_ENERGY_MAX = 1 << 15;

/**
 * The balance values the deterministic GPU simulation reads for a whole
 * match, converted once on the CPU (ADR 0015, decision 1): shares and
 * energies as Q14, chances as thresholds for a 32 bit draw, and the per
 * second rates as what they come to in one step of {@link TICK_SEC} - the
 * length every step has, whatever the display does (`MatchEngine` steps
 * the simulation by whole ticks).
 */
export interface IntMatchUniforms {
  /** Q14, at most 1. */
  jitter: number;
  /** Q14 energy. */
  divideThreshold: number;
  /** Q14, at most 1. */
  parentShare: number;
  /** Q14 energy, at most {@link INT_ENERGY_MAX}. */
  maxEnergy: number;
  /** Q14 energy, at most {@link INT_ENERGY_MAX}. */
  superMaxEnergy: number;
  /** Q14 energy, at most {@link INT_ENERGY_MAX}. */
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
  /** Q14, at most 1 - how much an own neighbour's energy defends. */
  defenceFactor: number;
  /** Q14 energy. */
  frontlinePressure: number;
  /** Q14 energy a step regains while nobody attacks. */
  regenStep: number;
  /** Q14 energy a step above the ceiling bleeds away. */
  overchargeDecayStep: number;
  /** Q14 energy a step on antibiotic ground drains. */
  antibioticStep: number;
  /** Q14 energy a step in an enemy's toxin cloud drains. */
  toxinStep: number;
  /** Q14 energy a step takes from each pellet in reach. */
  nutrientStep: number;
  /** Q14 energy a kill feeds each bacterium of the killers around it. */
  feed: number;
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
  const energy = (value: number) =>
    Math.min(INT_ENERGY_MAX, toUnsignedQ14(value));
  const perStep = (perSec: number) => toUnsignedQ14(perSec * TICK_SEC);
  return {
    jitter: toQ14(balance.jitter),
    divideThreshold: toUnsignedQ14(balance.divideEnergyThreshold),
    parentShare: toQ14(balance.parentEnergyShare),
    maxEnergy: energy(balance.maxEnergy),
    superMaxEnergy: energy(balance.superChargedMaxEnergy),
    captureEnergy: energy(balance.captureEnergy),
    consumeChance: chanceThreshold(balance.consumeChance),
    ...INT_EFFECTS,
    defenceFactor: toQ14(balance.defenceFactor),
    frontlinePressure: energy(balance.frontlinePressure),
    regenStep: perStep(balance.energyRegenPerSec),
    overchargeDecayStep: perStep(balance.overchargeDecayPerSec),
    antibioticStep: perStep(ZONE_EFFECTS.antibioticDrainPerSec),
    toxinStep: perStep(WEAPON_EFFECTS.toxinDrainPerSec),
    nutrientStep: perStep(balance.nutrientDrainPerSec),
    feed: energy(balance.feedEnergyPerCapture),
  };
}
