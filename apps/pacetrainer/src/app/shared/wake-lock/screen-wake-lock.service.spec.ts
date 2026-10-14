import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideRepositoryMock } from '../repository/provide-repository.mock';
import { TrainingRunnerService } from '../training-runner/training-runner.service';
import { ScreenWakeLockService } from './screen-wake-lock.service';

interface FakeSentinel {
  released: boolean;
  release: () => Promise<void>;
}

describe('ScreenWakeLockService', () => {
  let pending: ((sentinel: FakeSentinel) => void)[];
  let granted: FakeSentinel[];
  let runner: TrainingRunnerService;

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
    await new Promise((resolve) => setTimeout(resolve));
  }

  beforeEach(() => {
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
    runner = TestBed.inject(TrainingRunnerService);
    TestBed.inject(ScreenWakeLockService);
  });

  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
  });

  it('releases every lock after a quick pause and resume', async () => {
    runner.toggleTraining(); // running: first request pending
    await settle();
    runner.toggleTraining(); // paused
    await settle();
    runner.toggleTraining(); // running again
    await settle();

    grantNext();
    await settle();
    grantNext();
    await settle();

    runner.endTraining();
    await settle();

    expect(granted.length).toBeGreaterThan(0);
    expect(granted.every((sentinel) => sentinel.released)).toBe(true);
  });
});
