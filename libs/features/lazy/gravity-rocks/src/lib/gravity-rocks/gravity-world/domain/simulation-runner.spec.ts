import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  GravityWorldConfig,
  MAX_SIMULATION_SPEED,
  MIN_SIMULATION_SPEED,
} from './gravity-world-config';
import { MAX_TICK_YEARS, MAX_TICKS_PER_FRAME } from './gravity-world.service';
import { SimulationRunner, YEARS_PER_SECOND } from './simulation-runner';
import { GRAVITATIONAL_CONSTANT } from './solar-system';

describe('SimulationRunner', () => {
  let settings: WritableSignal<GravityWorldConfig>;
  let advance: jest.Mock<void, [number, number]>;
  let afterStep: jest.Mock<void, []>;
  let runner: SimulationRunner;

  beforeEach(() => {
    settings = signal({
      gravitationalConstant: GRAVITATIONAL_CONSTANT,
      massOfSun: 1,
      showTrail: true,
      showVelocity: false,
      trailLength: 100,
      simulationSpeed: 1,
    });
    advance = jest.fn();
    afterStep = jest.fn();
    runner = TestBed.runInInjectionContext(
      () => new SimulationRunner({ settings, advance, afterStep })
    );
  });

  afterEach(() => jest.restoreAllMocks());

  describe('step', () => {
    it('should advance the world by the frame times speed in years', () => {
      settings.update((s) => ({ ...s, simulationSpeed: 2 }));

      runner.step(0.1);

      expect(advance).toHaveBeenCalledWith(0.1 * 2 * YEARS_PER_SECOND, 100);
    });

    it('should let the followed body be caught up with after moving', () => {
      runner.step(0.01);

      expect(afterStep).toHaveBeenCalledTimes(1);
      expect(advance.mock.invocationCallOrder[0]).toBeLessThan(
        afterStep.mock.invocationCallOrder[0]
      );
    });

    it('should keep no trail while trails are switched off', () => {
      settings.update((s) => ({ ...s, showTrail: false }));

      runner.step(0.01);

      expect(advance).toHaveBeenCalledWith(expect.any(Number), 0);
    });

    it('should drop the time of a frame the tab slept through', () => {
      settings.update((s) => ({ ...s, simulationSpeed: MAX_SIMULATION_SPEED }));

      runner.step(60);

      expect(advance).toHaveBeenCalledWith(
        MAX_TICKS_PER_FRAME * MAX_TICK_YEARS,
        100
      );
    });

    it('should clamp a speed outside the slider range', () => {
      settings.update((s) => ({ ...s, simulationSpeed: 1e-6 }));

      runner.step(0.1);

      expect(advance).toHaveBeenCalledWith(
        0.1 * MIN_SIMULATION_SPEED * YEARS_PER_SECOND,
        100
      );
    });

    it('should fall back to the initial speed when none is set', () => {
      settings.update((s) => ({ ...s, simulationSpeed: 0 }));

      runner.step(0.1);

      expect(advance).toHaveBeenCalledWith(0.1 * YEARS_PER_SECOND, 100);
    });
  });

  describe('running', () => {
    it('should start paused', () => {
      expect(runner.running()).toBe(false);
    });

    it('should start and pause on toggle', () => {
      runner.toggle();
      expect(runner.running()).toBe(true);

      runner.toggle();
      expect(runner.running()).toBe(false);
    });

    it('should stop', () => {
      runner.toggle();

      runner.stop();

      expect(runner.running()).toBe(false);
    });
  });

  describe('suspend and resume', () => {
    it('should pick a running world back up after a suspend', () => {
      runner.toggle();

      runner.suspend();
      expect(runner.running()).toBe(false);

      runner.resume();
      expect(runner.running()).toBe(true);
    });

    it('should not start a world that was paused before the suspend', () => {
      runner.suspend();

      runner.resume();

      expect(runner.running()).toBe(false);
    });

    it('should stay owed its restart when suspended twice', () => {
      runner.toggle();
      runner.suspend();

      runner.suspend();
      runner.resume();

      expect(runner.running()).toBe(true);
    });

    it('should not resume once toggled by hand in between', () => {
      runner.toggle();
      runner.suspend();
      runner.toggle();
      runner.toggle();

      runner.resume();

      expect(runner.running()).toBe(false);
    });

    it('should forget the owed restart on reset', () => {
      runner.toggle();
      runner.suspend();

      runner.reset();
      runner.resume();

      expect(runner.running()).toBe(false);
    });
  });

  describe('frame loop', () => {
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      frames = [];
      jest
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => {
          frames.push(callback);
          return frames.length;
        });
    });

    /**
     * Runs every callback waiting for the next frame, at `time` milliseconds,
     * as a browser would. Angular's own scheduler waits for frames too.
     */
    function frame(time: number): void {
      for (const callback of frames.splice(0)) {
        callback(time);
      }
    }

    it('should not step while paused', () => {
      TestBed.tick();

      frame(1000);
      frame(1016);

      expect(advance).not.toHaveBeenCalled();
    });

    it('should step once per frame by the time between them', () => {
      runner.toggle();
      TestBed.tick();

      frame(1000);
      frame(1100);

      expect(advance).toHaveBeenCalledTimes(2);
      expect(advance).toHaveBeenNthCalledWith(
        1,
        (1 / 120) * YEARS_PER_SECOND,
        100
      );
      expect(advance.mock.calls[1][0]).toBeCloseTo(0.1 * YEARS_PER_SECOND, 10);
    });

    it('should stop stepping once paused', () => {
      runner.toggle();
      TestBed.tick();
      frame(1000);

      runner.toggle();
      TestBed.tick();
      frame(1016);
      frame(1032);

      expect(advance).toHaveBeenCalledTimes(1);
    });
  });
});
