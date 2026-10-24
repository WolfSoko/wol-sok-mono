import { intSimulation } from '../state/gpu-int/int-simulation';
import { GameBalance } from '../state/game-balance';
import { cpuSimulation } from '../state/match-engine';
import { Ruleset, Simulation, SimulationFactory } from '../state/simulation';
import type { GpuSimulationOptions } from './gpu-simulation';

export { DETERMINISTIC_SIMULATION } from '../state/simulation';

/** Builds a GPU simulation on the arena's context. */
export type GpuFactory = (
  balance: GameBalance,
  random: () => number,
  options: GpuSimulationOptions
) => Simulation;

export { intSimulation };

/** Which simulation the matches run, and the one to fall back to. */
export interface SimulationChoice {
  /** Null for the CPU one - see `PlayerService.useSimulation`. */
  factory: SimulationFactory | null;
  /**
   * Takes over when the factory's simulation fails to start - a shader the
   * driver rejects, a format it cannot render into: the CPU's ruleset.
   */
  fallback: SimulationFactory;
  /**
   * The ruleset the factory's simulations play by right now: `gpu-int` for
   * the integer GPU passes, `cpu` for the CPU, null for the float GPU one.
   */
  ruleset: () => Ruleset | null;
  /**
   * The rulesets this device offers the other one of an online match:
   * `gpu-int` only where its GPU passed the self-test - whatever an
   * override plays locally - and `cpu` always.
   */
  offers: () => readonly Ruleset[];
}

/**
 * The simulation of the next matches:
 * - not deterministic: the float GPU one where there is a WebGL2 context,
 *   the CPU one (`BacteriaSimulation`) else, as before ADR 0015;
 * - deterministic: the integer GPU passes where the GPU passed the
 *   self-test by the time a match starts, the CPU's ruleset else - a GPU
 *   not tested yet, or failed, plays the `cpu` ruleset (the owner's
 *   decision: `IntSimulation` replays and checks, it does not play live).
 *
 * `override` is the device override for a real-device check
 * (`SimulationOverrideService`): `gpu-int` plays the integer GPU passes
 * whatever the self-test said, `cpu` the CPU's ruleset. It changes what
 * this device plays locally, never what it offers online.
 */
export function chooseSimulation(options: {
  deterministic: boolean;
  gpu: GpuFactory | null;
  gpuTrusted: () => boolean;
  override?: () => Ruleset | null;
}): SimulationChoice {
  const { gpu, gpuTrusted } = options;
  const override = options.override ?? (() => null);
  if (!options.deterministic && gpu != null) {
    // Switched off: the float GPU simulation - unless the device override
    // opts this device in for a real-device check, locally only.
    const optedIn = () => override() === 'gpu-int';
    return {
      factory: (balance, random, seed) =>
        optedIn()
          ? gpu(balance, random, { deterministic: true, matchSeed: seed })
          : gpu(balance, random, { matchSeed: seed }),
      fallback: cpuSimulation,
      ruleset: () => (optedIn() ? 'gpu-int' : null),
      offers: () => ['cpu'],
    };
  }
  if (!options.deterministic) {
    return {
      factory:
        gpu == null
          ? null
          : (balance, random, seed) =>
              gpu(balance, random, { matchSeed: seed }),
      fallback: cpuSimulation,
      ruleset: () => (gpu == null ? 'cpu' : null),
      offers: () => ['cpu'],
    };
  }
  const offersGpu = () => gpu != null && gpuTrusted();
  const playsGpu = () => {
    const forced = override();
    return (
      gpu != null && (forced === null ? gpuTrusted() : forced === 'gpu-int')
    );
  };
  return {
    factory: (balance, random, seed) =>
      gpu != null && playsGpu()
        ? gpu(balance, random, { deterministic: true, matchSeed: seed })
        : cpuSimulation(balance, random, seed),
    fallback: cpuSimulation,
    ruleset: () => (playsGpu() ? 'gpu-int' : 'cpu'),
    offers: () => (offersGpu() ? ['cpu', 'gpu-int'] : ['cpu']),
  };
}
