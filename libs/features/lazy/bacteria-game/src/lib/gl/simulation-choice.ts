import { IntSimulation } from '../state/gpu-int/int-simulation';
import { GameBalance } from '../state/game-balance';
import { cpuSimulation } from '../state/match-engine';
import { Simulation, SimulationFactory } from '../state/simulation';
import type { GpuSimulationOptions } from './gpu-simulation';

/**
 * True when matches run the deterministic simulation of ADR 0015 - the
 * integer passes, on the GPU where it passed the self-test, else on the
 * CPU. Off until step 8 of the rollout switches it on together with the
 * version bumps and the online handshake.
 */
export const DETERMINISTIC_SIMULATION = false;

/** Builds a GPU simulation on the arena's context. */
export type GpuFactory = (
  balance: GameBalance,
  random: () => number,
  options: GpuSimulationOptions
) => Simulation;

/** The deterministic simulation on the CPU - see `IntSimulation`. */
export const intSimulation: SimulationFactory = (balance, random, seed) =>
  new IntSimulation(balance, random, seed);

/** Which simulation the matches run, and the one to fall back to. */
export interface SimulationChoice {
  /** Null for the CPU one - see `PlayerService.useSimulation`. */
  factory: SimulationFactory | null;
  /**
   * Takes over when the factory's simulation fails to start - a shader the
   * driver rejects, a format it cannot render into. A deterministic match
   * falls back to the deterministic CPU simulation, never the float one.
   */
  fallback: SimulationFactory;
}

/**
 * The simulation of the next matches:
 * - not deterministic: the float GPU one where there is a WebGL2 context,
 *   the CPU one (`BacteriaSimulation`) else, as ever;
 * - deterministic: the integer GPU one where the GPU passed the self-test
 *   by the time a match starts, `IntSimulation` else - a GPU not tested
 *   yet, or failed, plays on the CPU.
 */
export function chooseSimulation(options: {
  deterministic: boolean;
  gpu: GpuFactory | null;
  gpuTrusted: () => boolean;
}): SimulationChoice {
  const { gpu, gpuTrusted } = options;
  if (!options.deterministic) {
    return {
      factory:
        gpu == null
          ? null
          : (balance, random, seed) =>
              gpu(balance, random, { matchSeed: seed }),
      fallback: cpuSimulation,
    };
  }
  return {
    factory: (balance, random, seed) =>
      gpu != null && gpuTrusted()
        ? gpu(balance, random, { deterministic: true, matchSeed: seed })
        : intSimulation(balance, random, seed),
    fallback: intSimulation,
  };
}
