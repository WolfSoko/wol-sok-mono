import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { milliseconds } from '@wolsok/utils-time';
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

  function countDown(timeLeft: number): void {
    service.updateCountdown(
      milliseconds(5000),
      milliseconds(timeLeft),
      'sprint'
    );
    TestBed.tick();
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

  it('says "Jetzt" one lead before the Intervall, not a second before it', () => {
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

  it('stays silent once the countdown ended', () => {
    service.endCountdown();
    TestBed.tick();

    expect(spoken).toEqual([]);
    expect(FakeAudioContext.frequencies).toEqual([]);
  });
});
