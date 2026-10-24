import { BacteriaSimulation } from '../state/bacteria-simulation';
import { gameBalance } from '../state/game-balance';
import { IntSimulation } from '../state/gpu-int/int-simulation';
import { cpuSimulation } from '../state/match-engine';
import { Simulation } from '../state/simulation';
import type { GpuSimulationOptions } from './gpu-simulation';
import {
  chooseSimulation,
  GpuFactory,
  intSimulation,
} from './simulation-choice';

describe('chooseSimulation', () => {
  const random = () => 0.5;
  const gpuSim = { kind: 'gpu' } as Simulation;
  let asked: GpuSimulationOptions[];
  const gpu: GpuFactory = (_, __, options) => {
    asked.push(options);
    return gpuSim;
  };

  beforeEach(() => {
    asked = [];
  });

  describe('not deterministic', () => {
    it('runs the float simulation on the GPU, falling back to the CPU', () => {
      const { factory, fallback } = chooseSimulation({
        deterministic: false,
        gpu,
        gpuTrusted: () => false,
      });
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ matchSeed: 7 }]);
      expect(fallback).toBe(cpuSimulation);
    });

    it('leaves a device without WebGL2 to the CPU', () => {
      const { factory } = chooseSimulation({
        deterministic: false,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(factory).toBeNull();
    });
  });

  describe('deterministic', () => {
    it('runs the integer passes on a GPU that passed the self-test', () => {
      const { factory, fallback } = chooseSimulation({
        deterministic: true,
        gpu,
        gpuTrusted: () => true,
      });
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ deterministic: true, matchSeed: 7 }]);
      expect(fallback).toBe(intSimulation);
    });

    it('plays on the CPU while the GPU is untested or failed', () => {
      let trusted = false;
      const { factory } = chooseSimulation({
        deterministic: true,
        gpu,
        gpuTrusted: () => trusted,
      });
      expect(factory?.(gameBalance, random, 7)).toBeInstanceOf(IntSimulation);
      trusted = true;
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
    });

    it('plays on the CPU without WebGL2 - never the float simulation', () => {
      const { factory, fallback } = chooseSimulation({
        deterministic: true,
        gpu: null,
        gpuTrusted: () => true,
      });
      const simulation = factory?.(gameBalance, random, 7);
      expect(simulation).toBeInstanceOf(IntSimulation);
      expect(simulation).not.toBeInstanceOf(BacteriaSimulation);
      expect(fallback(gameBalance, random, 7)).toBeInstanceOf(IntSimulation);
    });
  });
});
