import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { milliseconds, seconds, sToMs } from '../model/constants/time-utils';
import {
  createRecoveryExercise,
  createSprintExercise,
} from '../model/training/excercise';
import { createIntervalWithDuration } from '../model/training/interval';
import {
  createTrainingWithDuration,
  TrainingConfigWithDuration,
} from '../model/training/training-config-with.duration';
import { provideRepositoryMock } from '../repository/provide-repository.mock';
import { RepositoryFactoryMock } from '../repository/repository.factory.mock';
import { TrainingRun } from './training-run';

/** 2 × (10 s sprint + 5 s recovery) = 30 s */
function konfiguration(
  repetitions = 2,
  sprintSeconds = 10,
  recoverySeconds = 5
): TrainingConfigWithDuration {
  return createTrainingWithDuration([
    createIntervalWithDuration(
      repetitions,
      createSprintExercise(sToMs(seconds(sprintSeconds))),
      createRecoveryExercise(sToMs(seconds(recoverySeconds)))
    ),
  ]);
}

describe('TrainingRun', () => {
  let run: TrainingRun;

  function createRun(): TrainingRun {
    return TestBed.inject(TrainingRun);
  }

  /** advances the clock in small steps, like a real interval timer */
  function advance(ms: number): void {
    vi.advanceTimersByTime(ms);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRepositoryMock()],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** simulates a page reload: a new TrainingRun reads what the old one stored */
  function reload(): TrainingRun {
    const stored = TestBed.inject(RepositoryFactoryMock).repository?.savedData;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRepositoryMock()],
    });
    TestBed.inject(RepositoryFactoryMock).initialData = stored;
    return createRun();
  }

  describe('reload', () => {
    beforeEach(() => {
      run = createRun();
    });

    it('restores a running Trainingslauf as paused', () => {
      run.start(konfiguration());
      advance(5000 + 12_000);

      const restored = reload();
      advance(3000);

      expect(restored.state()).toMatchObject({
        phase: 'paused',
        current: { name: 'recovery', index: 1, elapsed: 2000 },
        elapsed: 12_000,
      });
    });

    it('does not bring back a finished Trainingslauf', () => {
      run.start(konfiguration());
      advance(5000 + 12_000);
      run.end();

      expect(reload().state()).toEqual({ phase: 'ready' });
    });

    it('does not bring back a Vorlauf', () => {
      run.start(konfiguration());
      advance(2000);

      expect(reload().state()).toEqual({ phase: 'ready' });
    });

    it.each([
      ['garbage', { config: 'kaputt', elapsed: 'x' }],
      ['elapsed beyond the end', { config: konfiguration(), elapsed: 31_000 }],
      ['negative elapsed', { config: konfiguration(), elapsed: -1 }],
      ['missing elapsed', { config: konfiguration(), elapsed: null }],
      ['no Intervalle', { config: konfiguration(0), elapsed: 0 }],
    ])('starts ready when the stored run is unusable (%s)', (_, stored) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), provideRepositoryMock()],
      });
      TestBed.inject(RepositoryFactoryMock).initialData = stored as never;

      expect(createRun().state()).toEqual({ phase: 'ready' });
    });
  });

  describe('when the browser refuses to store the run', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection()],
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      run = createRun();
    });

    afterEach(() => vi.restoreAllMocks());

    it('keeps running after a pause', () => {
      run.start(konfiguration());
      advance(5000 + 2000);
      run.toggle();
      run.toggle();
      advance(3000);

      expect(run.state()).toMatchObject({ phase: 'running', elapsed: 5000 });
    });
  });

  describe('fresh run', () => {
    beforeEach(() => {
      run = createRun();
    });

    it('starts with a 5 s Vorlauf, then runs the first Intervall', () => {
      expect(run.state()).toEqual({ phase: 'ready' });

      run.start(konfiguration());
      expect(run.state()).toMatchObject({
        phase: 'leadIn',
        left: milliseconds(5000),
        total: milliseconds(5000),
      });

      advance(2000);
      expect(run.state()).toMatchObject({ phase: 'leadIn', left: 3000 });

      advance(3000);
      expect(run.state()).toMatchObject({
        phase: 'running',
        current: { name: 'sprint', index: 0, count: 4 },
        next: 'recovery',
      });
    });

    it('moves to the next Intervall exactly when the current one is over', () => {
      run.start(konfiguration());
      advance(5000 + 10_000);

      expect(run.state()).toMatchObject({
        current: { name: 'recovery', index: 1, elapsed: 0, left: 5000 },
        next: 'sprint',
      });
    });

    it('keeps no timer running unless the clock is needed', () => {
      run.start(konfiguration());
      run.end();
      expect(vi.getTimerCount()).toBe(0);

      run.start(konfiguration());
      advance(5000 + 1000);
      run.toggle();
      expect(vi.getTimerCount()).toBe(0);

      run.toggle();
      advance(30_000);
      expect(run.phase()).toBe('finished');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not run backwards when the system clock is set back', () => {
      run.start(konfiguration());
      advance(5000 + 3000);

      vi.setSystemTime(Date.now() - 60_000);
      advance(1000);

      expect(run.state()).toMatchObject({ phase: 'running', elapsed: 3950 });
    });

    it('ends at the total time even after a long gap between ticks', () => {
      run.start(konfiguration());
      advance(5000 + 1000);

      // e.g. the phone locked the screen and the browser paused the timer
      vi.setSystemTime(Date.now() + 120_000);
      advance(50);

      expect(run.state()).toMatchObject({
        phase: 'finished',
        summary: { elapsed: 30_000, completion: 'complete' },
      });
    });

    it('aborts back to ready when ended during the Vorlauf', () => {
      run.start(konfiguration());
      advance(2000);

      run.end();
      advance(5000);

      expect(run.state()).toEqual({ phase: 'ready' });
    });

    it('stands still while paused and resumes at once', () => {
      run.start(konfiguration());
      advance(5000 + 3000);
      expect(run.state()).toMatchObject({ current: { elapsed: 3000 } });

      run.toggle();
      advance(4000);
      expect(run.state()).toMatchObject({
        phase: 'paused',
        current: { elapsed: 3000, left: 7000 },
      });

      run.toggle();
      advance(1000);
      expect(run.state()).toMatchObject({
        phase: 'running',
        current: { elapsed: 4000 },
      });
    });

    it('finishes by itself after the last Intervall', () => {
      run.start(konfiguration());
      advance(5000 + 30_000 + 1000);

      expect(run.state()).toEqual({
        phase: 'finished',
        summary: {
          elapsed: 30_000,
          sprintsCompleted: 2,
          sprintsTotal: 2,
          completion: 'complete',
        },
      });
    });

    it('ends early with the sprints completed so far', () => {
      run.start(konfiguration());
      // first sprint and recovery done, second sprint started
      advance(5000 + 16_000);

      run.end();

      expect(run.state()).toEqual({
        phase: 'finished',
        summary: {
          elapsed: 16_000,
          sprintsCompleted: 1,
          sprintsTotal: 2,
          completion: 'endedEarly',
        },
      });
    });

    it('ends early from a pause', () => {
      run.start(konfiguration());
      advance(5000 + 12_000);
      run.toggle();

      run.end();

      expect(run.state()).toMatchObject({
        phase: 'finished',
        summary: { elapsed: 12_000, completion: 'endedEarly' },
      });
    });

    it('starts a fresh run after "Neues Training"', () => {
      run.start(konfiguration());
      advance(5000 + 30_000 + 1000);

      run.reset();
      expect(run.state()).toEqual({ phase: 'ready' });

      run.start(konfiguration());
      advance(5000 + 2000);
      expect(run.state()).toMatchObject({
        phase: 'running',
        current: { index: 0, elapsed: 2000 },
        elapsed: 2000,
      });
    });

    it('runs single exercises that are not part of a repetition', () => {
      run.start(
        createTrainingWithDuration([
          createRecoveryExercise(sToMs(seconds(3))),
          createSprintExercise(sToMs(seconds(4))),
        ])
      );
      advance(5000 + 3500);

      expect(run.state()).toMatchObject({
        phase: 'running',
        current: { name: 'sprint', index: 1, count: 2, elapsed: 500 },
        next: 'finished',
      });
    });

    it('does not start a Konfiguration without Intervalle', () => {
      run.start(konfiguration(0));
      advance(6000);

      expect(run.state()).toEqual({ phase: 'ready' });
    });

    it('ignores commands that do not fit the current phase', () => {
      run.toggle();
      run.end();
      run.reset();
      expect(run.state()).toEqual({ phase: 'ready' });

      run.start(konfiguration());
      run.toggle();
      run.reset();
      run.start(konfiguration(1, 1, 1));
      expect(run.state()).toMatchObject({ phase: 'leadIn' });

      advance(5000 + 1000);
      run.start(konfiguration(1, 1, 1));
      run.reset();
      expect(run.state()).toMatchObject({
        phase: 'running',
        current: { count: 4, elapsed: 1000 },
      });
    });
  });
});
