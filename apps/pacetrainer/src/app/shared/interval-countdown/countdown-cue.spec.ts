import { describe, expect, it } from 'vitest';
import { milliseconds, seconds } from '@wolsok/utils-time';
import { CountdownTarget } from '../model/training/training-name';
import {
  CUE_LEAD,
  countdownCue,
  CountdownCue,
  cueSecond,
  cueSound,
  sameCue,
} from './countdown-cue';

const FIVE_SECOND_WINDOW = milliseconds(5000);

function cueAt(
  timeLeft: number,
  countdownTo: CountdownTarget = 'sprint'
): CountdownCue | null {
  return countdownCue({
    countdownTime: FIVE_SECOND_WINDOW,
    timeLeft: milliseconds(timeLeft),
    countdownTo,
  });
}

describe('CUE_LEAD', () => {
  it('starts every cue one second early', () => {
    expect(CUE_LEAD).toBe(1000);
  });
});

describe('cueSecond', () => {
  it.each([
    [6000, 6],
    [5999, 5],
    [5000, 5],
    [1999, 1],
    [1000, 1],
    [999, 0],
    [0, 0],
  ])('gives the cue of %i ms left to second %i', (timeLeft, second) => {
    expect(cueSecond(milliseconds(timeLeft))).toBe(second);
  });

  it('is one CUE_LEAD ahead of the seconds actually left', () => {
    expect(cueSecond(milliseconds(3000 + CUE_LEAD - 1))).toBe(3);
  });
});

describe('countdownCue', () => {
  it('stays silent while the window is more than a lead away', () => {
    expect(cueAt(6000)).toBeNull();
  });

  it('announces the next Intervall a lead before the window', () => {
    expect(cueAt(5999)).toEqual({
      kind: 'announcement',
      secondsLeft: 5,
      countdownTo: 'sprint',
    });
  });

  it.each([
    [4999, 4],
    [3999, 3],
    [2999, 2],
    [1999, 1],
  ])('beeps at %i ms left for second %i', (timeLeft, second) => {
    expect(cueAt(timeLeft)).toEqual({
      kind: 'beep',
      secondsLeft: second,
      countdownTo: 'sprint',
    });
  });

  it('says "Jetzt" a lead before the Intervall starts, not on it', () => {
    expect(cueAt(1000)?.kind).toBe('beep');
    expect(cueAt(999)).toEqual({
      kind: 'start',
      secondsLeft: 0,
      countdownTo: 'sprint',
    });
  });

  it('announces a window shorter than the lead at once', () => {
    expect(
      countdownCue({
        countdownTime: milliseconds(400),
        timeLeft: milliseconds(400),
        countdownTo: 'recovery',
      })
    ).toEqual({
      kind: 'announcement',
      secondsLeft: 0,
      countdownTo: 'recovery',
    });
  });
});

describe('cueSound', () => {
  it('names the next Intervall in its announcement', () => {
    expect(
      cueSound(
        { kind: 'announcement', secondsLeft: 5, countdownTo: 'sprint' },
        'Sprinten'
      )
    ).toEqual({
      frequency: 440,
      length: seconds(0.4),
      text: 'Sprinten in 5 Sekunden!',
    });
  });

  it('beeps without words', () => {
    expect(
      cueSound(
        { kind: 'beep', secondsLeft: 3, countdownTo: 'sprint' },
        'Sprinten'
      )
    ).toEqual({ frequency: 880, length: seconds(0.4), text: undefined });
  });

  it('calls the runner to the Intervall', () => {
    expect(
      cueSound(
        { kind: 'start', secondsLeft: 0, countdownTo: 'recovery' },
        'Erholung'
      )
    ).toEqual({
      frequency: 660,
      length: seconds(0.8),
      text: 'Jetzt Erholung!',
    });
  });

  it('counts the last seconds of the training down', () => {
    expect(
      cueSound(
        { kind: 'announcement', secondsLeft: 5, countdownTo: 'finished' },
        'Fertig'
      ).text
    ).toBe('Noch 5 Sekunden!');
  });

  it('ends the training with praise', () => {
    expect(
      cueSound(
        { kind: 'start', secondsLeft: 0, countdownTo: 'finished' },
        'Fertig'
      ).text
    ).toBe('Training beendet. Gut gemacht!');
  });
});

describe('sameCue', () => {
  const beep: CountdownCue = {
    kind: 'beep',
    secondsLeft: 3,
    countdownTo: 'sprint',
  };

  it('matches the same cue of the same countdown', () => {
    expect(sameCue(beep, { ...beep })).toBe(true);
    expect(sameCue(null, null)).toBe(true);
  });

  it('tells cues of another second or Intervall apart', () => {
    expect(sameCue(beep, { ...beep, secondsLeft: 2 })).toBe(false);
    expect(sameCue(beep, { ...beep, countdownTo: 'recovery' })).toBe(false);
    expect(sameCue(null, beep)).toBe(false);
  });
});
