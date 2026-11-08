import { intSimulation } from './gpu-int/int-reference-passes';
import { cpuSimulation } from './match-engine';
import { Ruleset, Simulation, SimulationFactory } from './simulation';

/**
 * What a match asks the provider for: a ruleset both sides play alike -
 * an online match's, a ranked one's, a recording's - or `'device'`, the
 * simulation this device plays a match of its own on right now.
 */
export type SimulationRequest = Ruleset | 'device';

/**
 * What this device plays a match of its own on: a ruleset, or the float
 * GPU simulation, whose matches no device plays again alike.
 */
export type DevicePlay = Ruleset | 'gpu-float';

/** The simulations a device's GPU runs - the game's WebGL2 adapter. */
export interface GpuSimulations {
  /** The integer passes of ADR 0015: the `gpu-int` ruleset on the GPU. */
  int: SimulationFactory;
  /** The float simulation, absent where the GPU only plays `gpu-int`. */
  float?: SimulationFactory;
}

/** The arena a simulation is sized to. */
export interface ArenaSize {
  width: number;
  height: number;
}

/** What a {@link SimulationProvider} is built from. */
export interface SimulationSources {
  /** This device's GPU, absent or null without one. */
  gpu?: GpuSimulations | null;
  /**
   * What the device plays a match of its own on, read as each match
   * starts - `cpu` when absent. A GPU value without the GPU plays `cpu`.
   */
  plays?: () => DevicePlay;
  /**
   * The rulesets this device offers the other one of an online match -
   * `cpu` only when absent.
   */
  offers?: () => readonly Ruleset[];
  /** Told once the GPU failed to start and the provider stepped down. */
  onFallback?: (error: unknown) => void;
}

/**
 * Which simulation plays a ruleset on this device, and what stands in when
 * the GPU fails to start. Once it failed, the provider steps down for good:
 * every later match plays on the CPU, and the device offers `cpu` only.
 */
export interface SimulationProvider {
  /**
   * Builds the simulation of one match, sized to `arena` where it is given.
   * A GPU simulation that fails to start or to be sized is let go of, and
   * the match plays on the stand-in that keeps the request's ruleset:
   * `IntSimulation` for `gpu-int`, `BacteriaSimulation` for the device's
   * own match.
   */
  simulationFor(
    request: SimulationRequest,
    arena?: ArenaSize
  ): SimulationFactory;
  /**
   * The ruleset `'device'` plays by right now - null for the float GPU
   * simulation.
   */
  ruleset(): Ruleset | null;
  /** The rulesets this device offers the other one of an online match. */
  offers(): readonly Ruleset[];
  /** True while `gpu-int` plays on this device's GPU. */
  gpuIntReady(): boolean;
}

/** See {@link SimulationProvider}. */
export function createSimulationProvider(
  sources: SimulationSources
): SimulationProvider {
  let gpu = sources.gpu ?? null;
  /** The factory a device play runs on - null: the CPU's. */
  const gpuFactoryOf = (play: DevicePlay): SimulationFactory | null => {
    switch (play) {
      case 'gpu-int':
        return gpu?.int ?? null;
      case 'gpu-float':
        return gpu?.float ?? null;
      default:
        return null;
    }
  };
  const devicePlay = (): DevicePlay => {
    const play = sources.plays?.() ?? 'cpu';
    return gpuFactoryOf(play) === null ? 'cpu' : play;
  };
  const stepDown = (error: unknown): void => {
    gpu = null;
    console.warn('The colony war falls back to the CPU', error);
    sources.onFallback?.(error);
  };

  return {
    simulationFor: (request, arena) => (balance, random, seed) => {
      const play = request === 'device' ? devicePlay() : request;
      const onCpu = play === 'gpu-int' ? intSimulation : cpuSimulation;
      const onGpu = gpuFactoryOf(play);
      if (onGpu === null) {
        return sized(onCpu(balance, random, seed), arena);
      }
      // The device's own match may change its ruleset, a requested one not.
      const standIn = request === 'device' ? cpuSimulation : onCpu;
      let simulation: Simulation | null = null;
      try {
        simulation = onGpu(balance, random, seed);
        return sized(simulation, arena);
      } catch (error) {
        // Let go of the context listeners, or a restored context revives it.
        simulation?.dispose();
        stepDown(error);
        return sized(standIn(balance, random, seed), arena);
      }
    },
    ruleset: () => {
      const play = devicePlay();
      return play === 'gpu-float' ? null : play;
    },
    offers: () => (gpu === null ? ['cpu'] : (sources.offers?.() ?? ['cpu'])),
    gpuIntReady: () => gpu !== null,
  };
}

/**
 * The engine's default: no GPU - `cpu` plays on `BacteriaSimulation`,
 * `gpu-int` on `IntSimulation`, the device's own matches on the CPU.
 */
export const CPU_SIMULATIONS: SimulationProvider = createSimulationProvider({});

/** The simulation, sized to the arena where it is known. */
function sized(simulation: Simulation, arena?: ArenaSize): Simulation {
  if (arena != null) {
    simulation.resize(arena.width, arena.height);
  }
  return simulation;
}
