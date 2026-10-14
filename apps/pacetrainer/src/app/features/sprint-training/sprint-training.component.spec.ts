import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntervalCountdownService } from '../../shared/interval-countdown/interval-countdown.service';
import { seconds, sToMs } from '../../shared/model/constants/time-utils';
import { provideRepositoryMock } from '../../shared/repository/provide-repository.mock';
import { SprintTrainingDataService } from '../training-configuration/data/sprint-training-data.service';
import { SprintTrainingComponent } from './sprint-training.component';

describe('SprintTrainingComponent Ansagen', () => {
  let fixture: ComponentFixture<SprintTrainingComponent>;
  let countdown: IntervalCountdownService['countdown'];

  function advance(ms: number): void {
    vi.advanceTimersByTime(ms);
    TestBed.tick();
  }

  function clickPrimary(): void {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-qa="toggle-training"]'
    );
    button.click();
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      imports: [SprintTrainingComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRepositoryMock(),
      ],
    });
    // 1 × (10 s sprint + 3 s recovery)
    TestBed.inject(SprintTrainingDataService).updateState({
      repetitions: 1,
      sprintTime: sToMs(seconds(10)),
      recoveryTime: sToMs(seconds(3)),
    });
    countdown = TestBed.inject(IntervalCountdownService).countdown;
    fixture = TestBed.createComponent(SprintTrainingComponent);
    TestBed.tick();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('announces nothing before the start', () => {
    expect(countdown()).toBeNull();
  });

  it('counts the Vorlauf down to "Bereit"', () => {
    clickPrimary();
    advance(2000);

    expect(countdown()).toEqual({
      countdownTime: 5000,
      timeLeft: 3000,
      countdownTo: 'getready',
    });
  });

  it('counts down to the next Intervall within at most 5 s', () => {
    clickPrimary();
    advance(5000 + 6000);

    expect(countdown()).toEqual({
      countdownTime: 5000,
      timeLeft: 4000,
      countdownTo: 'recovery',
    });
  });

  it('uses the whole Intervall as window when it is shorter than 5 s', () => {
    clickPrimary();
    advance(5000 + 11_000);

    expect(countdown()).toEqual({
      countdownTime: 3000,
      timeLeft: 2000,
      countdownTo: 'finished',
    });
  });

  it('keeps the countdown while paused', () => {
    clickPrimary();
    advance(5000 + 6000);
    clickPrimary(); // pause
    advance(2000);

    expect(countdown()).toMatchObject({ timeLeft: 4000 });
  });

  it('stops announcing once the Trainingslauf is finished', () => {
    clickPrimary();
    advance(5000 + 13_000 + 100);

    expect(countdown()).toBeNull();
  });
});
