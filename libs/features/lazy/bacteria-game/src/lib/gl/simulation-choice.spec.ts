import { gameBalance, Simulation } from '@wolsok/feat-shared-bacteria-engine';
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
    it('plays the float simulation on the GPU, offering cpu only', () => {
      const choice = chooseSimulation({
        deterministic: () => false,
        gpu,
        gpuTrusted: () => true,
      });
      expect(choice.plays()).toBe('gpu-float');
      expect(choice.offers()).toEqual(['cpu']);
      expect(choice.gpu?.float?.(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ matchSeed: 7 }]);
    });

    it('leaves a device without WebGL2 to the CPU', () => {
      const choice = chooseSimulation({
        deterministic: () => false,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(choice.plays()).toBe('cpu');
      expect(choice.gpu).toBeNull();
    });
  });

  describe('deterministic', () => {
    it('plays the integer passes on a GPU that passed the self-test', () => {
      const choice = chooseSimulation({
        deterministic: () => true,
        gpu,
        gpuTrusted: () => true,
      });
      expect(choice.plays()).toBe('gpu-int');
      expect(choice.offers()).toEqual(['cpu', 'gpu-int']);
      expect(choice.gpu?.int(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ deterministic: true, matchSeed: 7 }]);
    });

    it('plays the cpu ruleset while the GPU is untested or failed', () => {
      let trusted = false;
      const choice = chooseSimulation({
        deterministic: () => true,
        gpu,
        gpuTrusted: () => trusted,
      });
      expect(choice.plays()).toBe('cpu');
      expect(choice.offers()).toEqual(['cpu']);
      trusted = true;
      expect(choice.plays()).toBe('gpu-int');
      expect(choice.offers()).toEqual(['cpu', 'gpu-int']);
    });

    it('plays the cpu ruleset without WebGL2 - never the float simulation', () => {
      const choice = chooseSimulation({
        deterministic: () => true,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(choice.plays()).toBe('cpu');
      expect(choice.offers()).toEqual(['cpu']);
    });

    it('follows the device override locally, never in what it offers', () => {
      let forced: 'cpu' | 'gpu-int' | null = 'gpu-int';
      const choice = chooseSimulation({
        deterministic: () => true,
        gpu,
        gpuTrusted: () => false,
        override: () => forced,
      });
      expect(choice.plays()).toBe('gpu-int');
      expect(choice.offers()).toEqual(['cpu']);

      forced = 'cpu';
      expect(choice.plays()).toBe('cpu');
    });
  });

  describe('switched off', () => {
    it('opts a device in for local play with the override, offering only cpu', () => {
      let forced: 'cpu' | 'gpu-int' | null = 'gpu-int';
      const choice = chooseSimulation({
        deterministic: () => false,
        gpu,
        gpuTrusted: () => true,
        override: () => forced,
      });
      expect(choice.plays()).toBe('gpu-int');
      expect(choice.offers()).toEqual(['cpu']);

      forced = null;
      expect(choice.plays()).toBe('gpu-float');
      expect(choice.offers()).toEqual(['cpu']);
    });

    it('plays the CPU where the device chose it', () => {
      const choice = chooseSimulation({
        deterministic: () => false,
        gpu,
        gpuTrusted: () => true,
        override: () => 'cpu',
      });
      expect(choice.plays()).toBe('cpu');
    });
  });

  describe("following the owner's toggle", () => {
    it('reads it as each match starts, and in what it offers', () => {
      let toggle = true;
      const choice = chooseSimulation({
        deterministic: () => toggle,
        gpu,
        gpuTrusted: () => true,
      });
      expect(choice.plays()).toBe('gpu-int');
      expect(choice.offers()).toEqual(['cpu', 'gpu-int']);

      toggle = false;
      expect(choice.plays()).toBe('gpu-float');
      expect(choice.offers()).toEqual(['cpu']);
    });

    it('leaves a device without WebGL2 to the CPU either way', () => {
      let toggle = false;
      const choice = chooseSimulation({
        deterministic: () => toggle,
        gpu: null,
        gpuTrusted: () => true,
      });
      expect(choice.plays()).toBe('cpu');
      toggle = true;
      expect(choice.plays()).toBe('cpu');
    });
  });

  describe('for an online match agreed on gpu-int', () => {
    it('runs the integer passes on the GPU, whatever the toggle and the override say now', () => {
      const choice = chooseSimulation({
        deterministic: () => false,
        gpu,
        gpuTrusted: () => false,
        override: () => 'cpu',
      });
      expect(choice.gpu?.int(gameBalance, random, 7)).toBe(gpuSim);
      expect(asked).toEqual([{ deterministic: true, matchSeed: 7 }]);
    });
  });
});
