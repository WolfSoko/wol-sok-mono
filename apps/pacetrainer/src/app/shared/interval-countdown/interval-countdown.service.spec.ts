import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { milliseconds } from '@wolsok/utils-time';
import { CountdownTarget } from '../model/training/training-name';
import { IntervalCountdownService } from './interval-countdown.service';

class FakeUtterance {
  public lang = '';
  public pitch = 1;
  public rate = 1;
  public volume = 1;
  public constructor(public readonly text: string) {}
}

class FakeAudioContext {
  public static readonly frequencies: number[] = [];
  public readonly currentTime = 0;
  public readonly destination = {};
  public readonly state = 'running';

  public createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: (frequency: number) =>
          FakeAudioContext.frequencies.push(frequency),
      },
      connect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
  }

  public createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
    };
  }
}

describe('IntervalCountdownService', () => {
  let service: IntervalCountdownService;
  let spoken: string[];

  function countDown(
    timeLeft: number,
    countdownTo: CountdownTarget = 'sprint'
  ): void {
    service.updateCountdown(
      milliseconds(5000),
      milliseconds(timeLeft),
      countdownTo
    );
    TestBed.tick();
  }

  function forgetSounds(): void {
    spoken.length = 0;
    FakeAudioContext.frequencies.length = 0;
  }

  beforeEach(() => {
    spoken = [];
    FakeAudioContext.frequencies.length = 0;
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      speak: (utterance: FakeUtterance) => spoken.push(utterance.text),
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()],
    });
    service = TestBed.inject(IntervalCountdownService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('says "Jetzt" below 1000 ms left, not at 1000 ms', () => {
    countDown(1000);
    expect(spoken).toEqual([]);

    countDown(999);
    expect(spoken).toEqual(['Jetzt Sprinten!']);
  });

  it('sounds each cue once however many ticks fall into its second', () => {
    for (let timeLeft = 5999; timeLeft >= 0; timeLeft -= 50) {
      countDown(timeLeft);
    }

    expect(spoken).toEqual(['Sprinten in 5 Sekunden!', 'Jetzt Sprinten!']);
    expect(FakeAudioContext.frequencies).toEqual([
      440, 880, 880, 880, 880, 660,
    ]);
  });

  it('repeats nothing while the training is paused', () => {
    countDown(2999);
    forgetSounds();

    countDown(2999);
    countDown(2999);

    expect(FakeAudioContext.frequencies).toEqual([]);
  });

  it('sounds the same second again for the next Intervall', () => {
    countDown(2999, 'recovery');
    forgetSounds();

    countDown(2999, 'sprint');

    expect(FakeAudioContext.frequencies).toEqual([880]);
  });

  it('counts the end of the training down and praises the runner', () => {
    countDown(5999, 'finished');
    countDown(999, 'finished');

    expect(spoken).toEqual([
      'Noch 5 Sekunden!',
      'Training beendet. Gut gemacht!',
    ]);
  });

  it('stays silent while the countdown is ended', () => {
    countDown(2999);
    forgetSounds();

    service.endCountdown();
    TestBed.tick();
    countDown(2999);

    expect(spoken).toEqual([]);
    expect(FakeAudioContext.frequencies).toEqual([]);
  });
});
