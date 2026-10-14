import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideRepositoryMock } from '../repository/provide-repository.mock';
import { seconds, sToMs } from '../model/constants/time-utils';
import {
  createRecoveryExercise,
  createSprintExercise,
} from '../model/training/excercise';
import { createIntervalWithDuration } from '../model/training/interval';
import { createTrainingWithDuration } from '../model/training/training-config-with.duration';
import { TrainingRun } from '../training-run/training-run';
import { ScreenWakeLockService } from './screen-wake-lock.service';

interface FakeSentinel {
  released: boolean;
  release: () => Promise<void>;
}

describe('ScreenWakeLockService', () => {
  let pending: ((sentinel: FakeSentinel) => void)[];
  let granted: FakeSentinel[];
  let run: TrainingRun;

  function grantNext(): void {
    const resolve = pending.shift();
    if (!resolve) {
      return;
    }
    const sentinel: FakeSentinel = {
      released: false,
      release: async () => {
        sentinel.released = true;
      },
    };
    granted.push(sentinel);
    resolve(sentinel);
  }

  async function settle(): Promise<void> {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    pending = [];
    granted = [];
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () =>
          new Promise<FakeSentinel>((resolve) => pending.push(resolve)),
      },
    });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRepositoryMock()],
    });
    run = TestBed.inject(TrainingRun);
    TestBed.inject(ScreenWakeLockService);
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as { wakeLock?: unknown }).wakeLock;
  });

  it('releases every lock after a quick pause and resume', async () => {
    run.start(
      createTrainingWithDuration([
        createIntervalWithDuration(
          1,
          createSprintExercise(sToMs(seconds(60))),
          createRecoveryExercise(sToMs(seconds(60)))
        ),
      ])
    );
    vi.advanceTimersByTime(5000); // after the Vorlauf: first request pending
    await settle();
    run.toggle(); // paused
    await settle();
    run.toggle(); // running again
    await settle();

    grantNext();
    await settle();
    grantNext();
    await settle();

    run.end();
    await settle();

    expect(granted.length).toBeGreaterThan(0);
    expect(granted.every((sentinel) => sentinel.released)).toBe(true);
  });
});
