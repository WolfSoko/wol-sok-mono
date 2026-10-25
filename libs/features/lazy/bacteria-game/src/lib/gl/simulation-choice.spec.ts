import { BacteriaSimulation } from '../state/bacteria-simulation';
import { gameBalance } from '../state/game-balance';
import { cpuSimulation } from '../state/match-engine';
import { Simulation } from '../state/simulation';
import type { GpuSimulationOptions } from './gpu-simulation';
import { chooseSimulation, GpuFactory } from './simulation-choice';

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
        deterministic: () => false,
        gpu,
        gpuTrusted: () => false,
      });
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ matchSeed: 7 }]);
      expect(fallback).toBe(cpuSimulation);
    });

    it('leaves a device without WebGL2 to the CPU', () => {
      const { factory, ruleset } = chooseSimulation({
        deterministic: () => false,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(factory?.(gameBalance, random, 7)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(ruleset()).toBe('cpu');
    });
  });

  describe('deterministic', () => {
    it('runs the integer passes on a GPU that passed the self-test', () => {
      const { factory, fallback, ruleset, offers } = chooseSimulation({
        deterministic: () => true,
        gpu,
        gpuTrusted: () => true,
      });
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ deterministic: true, matchSeed: 7 }]);
      expect(fallback).toBe(cpuSimulation);
      expect(ruleset()).toBe('gpu-int');
      expect(offers()).toEqual(['cpu', 'gpu-int']);
    });

    it('plays the cpu ruleset while the GPU is untested or failed', () => {
      let trusted = false;
      const { factory, ruleset, offers } = chooseSimulation({
        deterministic: () => true,
        gpu,
        gpuTrusted: () => trusted,
      });
      expect(factory?.(gameBalance, random, 7)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(ruleset()).toBe('cpu');
      expect(offers()).toEqual(['cpu']);
      trusted = true;
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(ruleset()).toBe('gpu-int');
    });

    it('plays the cpu ruleset without WebGL2 - never the float simulation', () => {
      const { factory, fallback, ruleset, offers } = chooseSimulation({
        deterministic: () => true,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(factory?.(gameBalance, random, 7)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(fallback(gameBalance, random, 7)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(ruleset()).toBe('cpu');
      expect(offers()).toEqual(['cpu']);
    });

    it('follows the device override locally, never in what it offers', () => {
      let forced: 'cpu' | 'gpu-int' | null = 'gpu-int';
      const { factory, ruleset, offers } = chooseSimulation({
        deterministic: () => true,
        gpu,
        gpuTrusted: () => false,
        override: () => forced,
      });
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(ruleset()).toBe('gpu-int');
      expect(offers()).toEqual(['cpu']);

      forced = 'cpu';
      expect(factory?.(gameBalance, random, 7)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(ruleset()).toBe('cpu');
    });
  });

  describe('switched off', () => {
    it('opts a device in for local play with the override, offering only cpu', () => {
      let forced: 'cpu' | 'gpu-int' | null = 'gpu-int';
      const { factory, ruleset, offers } = chooseSimulation({
        deterministic: () => false,
        gpu,
        gpuTrusted: () => true,
        override: () => forced,
      });
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked.at(-1)).toEqual({ deterministic: true, matchSeed: 7 });
      expect(ruleset()).toBe('gpu-int');
      expect(offers()).toEqual(['cpu']);

      forced = null;
      factory?.(gameBalance, random, 8);
      expect(asked.at(-1)).toEqual({ matchSeed: 8 });
      expect(ruleset()).toBeNull();
      expect(offers()).toEqual(['cpu']);
    });
  });

  describe("following the owner's toggle", () => {
    it('reads it as each match starts, and in what it offers', () => {
      let toggle = true;
      const { factory, ruleset, offers } = chooseSimulation({
        deterministic: () => toggle,
        gpu,
        gpuTrusted: () => true,
      });
      expect(factory?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked.at(-1)).toEqual({ deterministic: true, matchSeed: 7 });
      expect(ruleset()).toBe('gpu-int');
      expect(offers()).toEqual(['cpu', 'gpu-int']);

      toggle = false;
      expect(factory?.(gameBalance, random, 8)).toBe(gpuSim);
      expect(asked.at(-1)).toEqual({ matchSeed: 8 });
      expect(ruleset()).toBeNull();
      expect(offers()).toEqual(['cpu']);
    });

    it('leaves a device without WebGL2 to the CPU either way', () => {
      let toggle = false;
      const { factory, ruleset } = chooseSimulation({
        deterministic: () => toggle,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(factory?.(gameBalance, random, 7)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(ruleset()).toBe('cpu');
      toggle = true;
      expect(factory?.(gameBalance, random, 7)).toBeInstanceOf(
        BacteriaSimulation
      );
      expect(ruleset()).toBe('cpu');
    });
  });

  describe('for an online match agreed on gpu-int', () => {
    it('plays the integer passes on the GPU, whatever the toggle and the override say now', () => {
      const { gpuInt } = chooseSimulation({
        deterministic: () => false,
        gpu,
        gpuTrusted: () => false,
        override: () => 'cpu',
      });
      expect(gpuInt?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ deterministic: true, matchSeed: 7 }]);
    });

    it('has none without WebGL2', () => {
      const { gpuInt } = chooseSimulation({
        deterministic: () => true,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(gpuInt).toBeNull();
    });
  });
});
