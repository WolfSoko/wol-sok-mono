import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SprintTrainingDataService } from '../../features/training-configuration/data/sprint-training-data.service';
import { seconds, sToMs } from '../model/constants/time-utils';
import { provideRepositoryMock } from '../repository/provide-repository.mock';
import { TrainingRunnerService } from '../training-runner/training-runner.service';
import { TrainingProgressService } from './training-progress.service';

describe('TrainingProgressService', () => {
  let service: TrainingProgressService;
  let runner: TrainingRunnerService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRepositoryMock()],
    });
    TestBed.inject(SprintTrainingDataService).updateState({
      repetitions: 1,
      sprintTime: sToMs(seconds(1)),
      recoveryTime: sToMs(seconds(1)),
    });
    service = TestBed.inject(TrainingProgressService);
    runner = TestBed.inject(TrainingRunnerService);
    TestBed.tick();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      vi.advanceTimersByTime(50);
      TestBed.tick();
    }
  }

  function startRunner(): void {
    runner.toggleTraining();
    TestBed.tick();
  }

  it('starts the first exercise when the runner starts', () => {
    startRunner();
    advance(200);

    expect(service.trainingProgress().state).toBe('started');
    expect(service.trainingProgress().activeExerciseIndex).toBe(0);
  });

  it('ends the run on its own after the last exercise', () => {
    startRunner();
    advance(2500);

    expect(service.trainingProgress().state).toBe('finished');
    expect(runner.trainingState()).toBe('stopped');
  });

  it('starts from scratch when a new run follows a finished one', () => {
    startRunner();
    advance(2500);
    expect(runner.trainingState()).toBe('stopped');

    startRunner();
    advance(200);

    const progress = service.trainingProgress();
    expect(progress.state).toBe('started');
    expect(progress.activeExerciseIndex).toBe(0);
    expect(progress.exercises.every((e) => e.state !== 'finished')).toBe(true);
  });

  it('starts from scratch when a new run follows a stopped one', () => {
    startRunner();
    advance(1500);
    runner.endTraining();
    TestBed.tick();

    startRunner();
    advance(200);

    expect(service.trainingProgress().state).toBe('started');
    expect(service.trainingProgress().activeExerciseIndex).toBe(0);
  });
});
