import {
  DevicePlay,
  GameBalance,
  GpuSimulations,
  Ruleset,
  Simulation,
  SimulationSources,
} from '@wolsok/feat-shared-bacteria-engine';
import type { GpuSimulationOptions } from './gpu-simulation';

/** Builds a GPU simulation on the arena's context. */
export type GpuFactory = (
  balance: GameBalance,
  random: () => number,
  options: GpuSimulationOptions
) => Simulation;

/**
 * What a device plays and offers, and its GPU - all but the fallback's
 * hook, which `PlayerService` adds.
 */
export type DeviceSimulations = Omit<SimulationSources, 'onFallback'>;

/** Both simulations of ADR 0015 on a GPU, from its factory. */
export function gpuSimulationsOf(gpu: GpuFactory): GpuSimulations {
  return {
    int: (balance, random, seed) =>
      gpu(balance, random, { deterministic: true, matchSeed: seed }),
    float: (balance, random, seed) => gpu(balance, random, { matchSeed: seed }),
  };
}

/**
 * What this device plays and offers, for the engine's
 * `createSimulationProvider` - which owns the fallback should the GPU fail
 * to start:
 * - not deterministic: the float GPU simulation where there is a WebGL2
 *   context, the CPU one (`BacteriaSimulation`) else, as before ADR 0015;
 * - deterministic: the integer GPU passes where the GPU passed the
 *   self-test by the time a match starts, the CPU's ruleset else - a GPU
 *   not tested yet, or failed, plays the `cpu` ruleset (the owner's
 *   decision: `IntSimulation` replays and checks, it does not play live).
 *
 * `deterministic` is the owner's toggle (`deterministicSimulation`, ADR
 * 0012), read afresh as each match starts and by `offers` as each online
 * match does - a match keeps the simulation it started with, as it keeps
 * its balance.
 *
 * `override` is the device override for a real-device check
 * (`SimulationOverrideService`): `gpu-int` plays the integer GPU passes
 * whatever the self-test said, `cpu` the CPU's ruleset. It changes what
 * this device plays locally, never what it offers online.
 *
 * `gpu-int` is offered only where the GPU passed the self-test; an online
 * match agreed on it plays the integer passes on the GPU whatever the
 * toggle or the override say by the time it starts.
 */
export function chooseSimulation(options: {
  deterministic: () => boolean;
  gpu: GpuFactory | null;
  gpuTrusted: () => boolean;
  override?: () => Ruleset | null;
}): Required<DeviceSimulations> {
  const { deterministic, gpu, gpuTrusted } = options;
  const override = options.override ?? (() => null);
  const plays = (): DevicePlay => {
    const forced = override();
    if (gpu == null || forced === 'cpu') {
      return 'cpu';
    }
    if (forced === 'gpu-int') {
      return 'gpu-int';
    }
    if (!deterministic()) {
      return 'gpu-float';
    }
    return gpuTrusted() ? 'gpu-int' : 'cpu';
  };
  return {
    gpu: gpu == null ? null : gpuSimulationsOf(gpu),
    plays,
    offers: () =>
      deterministic() && gpu != null && gpuTrusted()
        ? ['cpu', 'gpu-int']
        : ['cpu'],
  };
}
