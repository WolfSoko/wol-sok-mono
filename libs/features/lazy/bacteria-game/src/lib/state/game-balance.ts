/**
 * Central tuning table for the bacteria war simulation.
 *
 * Every number that shapes how the game *feels* lives here so the dynamics can
 * be tweaked without touching the simulation code.
 */
export interface GameBalance {
  /** Radius of the blob each player starts with. */
  startBacteriaRadius: number;
  /** Hard cap so a runaway colony cannot starve the frame budget. */
  maxBacteriaPerPlayer: number;
  /**
   * Carrying capacity of the whole arena, split evenly between the colonies.
   *
   * Every colony gets its own share of it, so a colony that has grown to its
   * limit can never take the room to divide away from the other one - it has
   * to go and take bacteria off the enemy instead.
   */
  maxTotalBacteria: number;

  /** Regular energy ceiling of a bacterium. */
  maxEnergy: number;
  /** Ceiling a bacterium can reach while feeding on a nutrient. */
  superChargedMaxEnergy: number;
  /** Energy regained per second while nobody is attacking. */
  energyRegenPerSec: number;
  /** Energy above `maxEnergy` bleeds away at this rate. */
  overchargeDecayPerSec: number;

  /**
   * How much an own neighbour counts against enemy pressure. Below 1 on
   * purpose: attackers win ties, so frontlines are never stable.
   */
  defenceFactor: number;
  /** Flat pressure added as soon as a single enemy is adjacent. */
  frontlinePressure: number;
  /** Energy drained per second per point of pressure. */
  combatDrainPerSec: number;
  /**
   * Chance that a killed bacterium is digested instead of converted. Digesting
   * frees up carrying capacity, which is what keeps a battle from deadlocking.
   */
  consumeChance: number;
  /** Energy a bacterium is reborn with after being converted. */
  captureEnergy: number;
  /** Energy the surrounding attackers gain from a kill - fuels breakthroughs. */
  feedEnergyPerCapture: number;

  /** Minimum energy required to divide. */
  divideEnergyThreshold: number;
  /** Division attempts per second for an eligible bacterium. */
  divideChancePerSec: number;
  /** Share of the energy the parent keeps, the rest goes to the child. */
  parentEnergyShare: number;

  /** 0 = only follow the cursor, 1 = only hunt the enemy. */
  aggression: number;
  /** Edge length of a cell in the coarse enemy-density field. */
  influenceCellSize: number;
  /** Random wobble added to every movement direction. */
  jitter: number;

  /** Number of nutrient pellets on the map. */
  nutrientCount: number;
  /** Total energy stored in a fresh pellet. */
  nutrientEnergy: number;
  /** Energy a single bacterium sucks out of a pellet per second. */
  nutrientDrainPerSec: number;
  /** Bacteria within this Chebyshev distance can feed on a pellet. */
  nutrientRadius: number;
  /** Delay before a depleted pellet reappears somewhere else. */
  nutrientRespawnDelaySec: number;
}

export const gameBalance: GameBalance = {
  startBacteriaRadius: 14,
  maxBacteriaPerPlayer: 5000,
  maxTotalBacteria: 6000,

  maxEnergy: 1,
  superChargedMaxEnergy: 1.75,
  energyRegenPerSec: 0.35,
  overchargeDecayPerSec: 0.12,

  defenceFactor: 0.55,
  frontlinePressure: 0.35,
  combatDrainPerSec: 1.6,
  consumeChance: 0.5,
  captureEnergy: 0.35,
  feedEnergyPerCapture: 0.18,

  divideEnergyThreshold: 0.8,
  divideChancePerSec: 3,
  parentEnergyShare: 0.55,

  aggression: 0.45,
  influenceCellSize: 8,
  jitter: 0.25,

  nutrientCount: 8,
  nutrientEnergy: 14,
  nutrientDrainPerSec: 2.5,
  nutrientRadius: 2,
  nutrientRespawnDelaySec: 2.5,
};
