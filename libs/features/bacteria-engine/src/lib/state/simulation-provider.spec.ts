import { BacteriaSimulation } from './bacteria-simulation';
import { gameBalance } from './game-balance';
import { IntSimulation } from './gpu-int/int-simulation';
import { Simulation, SimulationFactory } from './simulation';
import {
  CPU_SIMULATIONS,
  createSimulationProvider,
  DevicePlay,
  GpuSimulations,
} from './simulation-provider';

const random = () => 0.5;
const SEED = 7;
const ARENA = { width: 64, height: 32 };

/** A GPU simulation as far as the provider can tell. */
function gpuSimulation(): Simulation & { disposed: boolean; size?: string } {
  const simulation = {
    kind: 'gpu',
    ruleset: null,
    disposed: false,
    size: undefined as string | undefined,
    resize(width: number, height: number) {
      simulation.size = `${width}x${height}`;
    },
    dispose() {
      simulation.disposed = true;
    },
  };
  return simulation as unknown as Simulation & {
    disposed: boolean;
    size?: string;
  };
}

const failing: SimulationFactory = () => {
  throw new Error('No GPU here');
};

describe('createSimulationProvider', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('without a GPU (CPU_SIMULATIONS)', () => {
    it('plays cpu on BacteriaSimulation and gpu-int on IntSimulation', () => {
      expect(
        CPU_SIMULATIONS.simulationFor('cpu')(gameBalance, random, SEED)
      ).toBeInstanceOf(BacteriaSimulation);
      expect(
        CPU_SIMULATIONS.simulationFor('gpu-int')(gameBalance, random, SEED)
      ).toBeInstanceOf(IntSimulation);
    });

    it('plays the device on the CPU, offering and playing cpu only', () => {
      expect(
        CPU_SIMULATIONS.simulationFor('device')(gameBalance, random, SEED)
      ).toBeInstanceOf(BacteriaSimulation);
      expect(CPU_SIMULATIONS.ruleset()).toBe('cpu');
      expect(CPU_SIMULATIONS.offers()).toEqual(['cpu']);
      expect(CPU_SIMULATIONS.gpuIntReady()).toBe(false);
    });

    it('plays a GPU choice of the device on the CPU', () => {
      const simulations = createSimulationProvider({
        plays: () => 'gpu-int',
      });

      expect(
        simulations.simulationFor('device')(gameBalance, random, SEED)
      ).toBeInstanceOf(BacteriaSimulation);
      expect(simulations.ruleset()).toBe('cpu');
    });

    it('sizes the simulation to the arena', () => {
      const resize = jest.spyOn(BacteriaSimulation.prototype, 'resize');

      CPU_SIMULATIONS.simulationFor('cpu', ARENA)(gameBalance, random, SEED);

      expect(resize).toHaveBeenCalledWith(ARENA.width, ARENA.height);
    });
  });

  describe('with a GPU', () => {
    let built: ReturnType<typeof gpuSimulation>[];
    let asked: string[];
    let gpu: GpuSimulations;

    beforeEach(() => {
      built = [];
      asked = [];
      gpu = {
        int: () => {
          asked.push('int');
          const simulation = gpuSimulation();
          built.push(simulation);
          return simulation;
        },
        float: () => {
          asked.push('float');
          const simulation = gpuSimulation();
          built.push(simulation);
          return simulation;
        },
      };
    });

    it('plays gpu-int on the GPU, cpu on BacteriaSimulation', () => {
      const simulations = createSimulationProvider({ gpu });

      expect(
        simulations.simulationFor('gpu-int')(gameBalance, random, SEED)
      ).toBe(built[0]);
      expect(
        simulations.simulationFor('cpu')(gameBalance, random, SEED)
      ).toBeInstanceOf(BacteriaSimulation);
      expect(simulations.gpuIntReady()).toBe(true);
    });

    it('plays what the device plays, read as each match starts', () => {
      let plays: DevicePlay = 'gpu-float';
      const simulations = createSimulationProvider({
        gpu,
        plays: () => plays,
        offers: () => ['cpu', 'gpu-int'],
      });
      const device = simulations.simulationFor('device');

      device(gameBalance, random, SEED);
      expect(asked).toEqual(['float']);
      expect(simulations.ruleset()).toBeNull();

      plays = 'gpu-int';
      device(gameBalance, random, SEED);
      expect(asked).toEqual(['float', 'int']);
      expect(simulations.ruleset()).toBe('gpu-int');

      plays = 'cpu';
      expect(device(gameBalance, random, SEED)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(simulations.ruleset()).toBe('cpu');
      expect(simulations.offers()).toEqual(['cpu', 'gpu-int']);
    });

    it('plays a float choice on the CPU without a float adapter', () => {
      const simulations = createSimulationProvider({
        gpu: { int: gpu.int },
        plays: () => 'gpu-float',
      });

      expect(
        simulations.simulationFor('device')(gameBalance, random, SEED)
      ).toBeInstanceOf(BacteriaSimulation);
      expect(simulations.ruleset()).toBe('cpu');
    });

    it('sizes a GPU simulation to the arena', () => {
      const simulations = createSimulationProvider({ gpu });

      simulations.simulationFor('gpu-int', ARENA)(gameBalance, random, SEED);

      expect(built[0].size).toBe('64x32');
    });
  });

  describe('when the GPU fails to start', () => {
    it("plays the device's match on the CPU and steps down for good", () => {
      const onFallback = jest.fn();
      const simulations = createSimulationProvider({
        gpu: { int: failing, float: failing },
        plays: () => 'gpu-int',
        offers: () => ['cpu', 'gpu-int'],
        onFallback,
      });
      expect(simulations.offers()).toEqual(['cpu', 'gpu-int']);

      expect(
        simulations.simulationFor('device')(gameBalance, random, SEED)
      ).toBeInstanceOf(BacteriaSimulation);

      expect(onFallback).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(simulations.ruleset()).toBe('cpu');
      expect(simulations.offers()).toEqual(['cpu']);
      expect(simulations.gpuIntReady()).toBe(false);
      expect(
        simulations.simulationFor('gpu-int')(gameBalance, random, SEED)
      ).toBeInstanceOf(IntSimulation);
      expect(onFallback).toHaveBeenCalledTimes(1);
    });

    it('keeps a gpu-int match on its ruleset with IntSimulation', () => {
      const onFallback = jest.fn();
      const simulations = createSimulationProvider({
        gpu: { int: failing },
        plays: () => 'gpu-int',
        onFallback,
      });

      expect(
        simulations.simulationFor('gpu-int')(gameBalance, random, SEED)
      ).toBeInstanceOf(IntSimulation);
      expect(onFallback).toHaveBeenCalledWith(expect.any(Error));
      expect(simulations.gpuIntReady()).toBe(false);
      expect(
        simulations.simulationFor('device')(gameBalance, random, SEED)
      ).toBeInstanceOf(BacteriaSimulation);
    });

    it('lets go of a simulation that fails while being sized', () => {
      const broken = gpuSimulation();
      broken.resize = () => {
        throw new Error('A simulation target is incomplete');
      };
      const simulations = createSimulationProvider({
        gpu: { int: () => broken },
      });

      const simulation = simulations.simulationFor('gpu-int', ARENA)(
        gameBalance,
        random,
        SEED
      );

      expect(broken.disposed).toBe(true);
      expect(simulation).toBeInstanceOf(IntSimulation);
      expect(simulations.gpuIntReady()).toBe(false);
    });

    it('does not swallow a failing stand-in', () => {
      const broken = gpuSimulation();
      broken.resize = () => {
        throw new Error('No room');
      };
      const simulations = createSimulationProvider({
        gpu: { int: () => broken },
      });
      // The stand-in cannot be sized either: nothing is left to fall back to.
      jest
        .spyOn(IntSimulation.prototype, 'resize')
        .mockImplementationOnce(() => {
          throw new Error('No memory');
        });

      expect(() =>
        simulations.simulationFor('gpu-int', ARENA)(gameBalance, random, SEED)
      ).toThrow('No memory');
    });
  });
});
