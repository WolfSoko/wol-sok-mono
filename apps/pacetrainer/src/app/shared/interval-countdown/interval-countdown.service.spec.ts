import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { milliseconds } from '@wolsok/utils-time';
import { CountdownTarget } from '../model/training/training-name';
import { IntervalCountdownService } from './interval-countdown.service';

/** long enough to keep the full five-second window */
const LONG_COUNTDOWN = 60_000;

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
    countdownTo: CountdownTarget = 'sprint',
    countdownTime = LONG_COUNTDOWN
  ): void {
    service.updateCountdown(
      milliseconds(countdownTime),
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

  it('leaves the Ansage of the Vorlauf a second before its first beep', () => {
    const soundsAt: number[] = [];
    for (let timeLeft = 5000; timeLeft >= 0; timeLeft -= 50) {
      const soundsBefore = FakeAudioContext.frequencies.length;
      countDown(timeLeft, 'sprint', 5000);
      if (FakeAudioContext.frequencies.length > soundsBefore) {
        soundsAt.push(timeLeft);
      }
    }

    expect(spoken).toEqual(['Sprinten in 4 Sekunden!', 'Jetzt Sprinten!']);
    expect(FakeAudioContext.frequencies).toEqual([440, 880, 880, 880, 660]);
    expect(soundsAt).toEqual([4950, 3950, 2950, 1950, 950]);
  });

  it('announces the single second of a 2 s Intervall in the singular', () => {
    for (let timeLeft = 2000; timeLeft >= 0; timeLeft -= 50) {
      countDown(timeLeft, 'sprint', 2000);
    }

    expect(spoken).toEqual(['Sprinten in 1 Sekunde!', 'Jetzt Sprinten!']);
  });

  it('speaks no Ansage twice when paused and resumed inside the window', () => {
    for (let timeLeft = 5999; timeLeft >= 3000; timeLeft -= 50) {
      countDown(timeLeft);
    }
    for (let pausedTick = 0; pausedTick < 10; pausedTick++) {
      countDown(2999);
    }
    for (let timeLeft = 2999; timeLeft >= 0; timeLeft -= 50) {
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
