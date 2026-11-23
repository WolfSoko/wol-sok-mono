import { describe, expect, it } from 'vitest';
import { milliseconds, seconds } from '@wolsok/utils-time';
import { CountdownTarget } from '../model/training/training-name';
import {
  ANNOUNCEMENT_WINDOW,
  CUE_LEAD,
  countdownCue,
  CountdownCue,
  cueSecond,
  cueSound,
  sameCue,
} from './countdown-cue';

const LONG_COUNTDOWN = milliseconds(60_000);

function cueAt(
  timeLeft: number,
  countdownTo: CountdownTarget = 'sprint'
): CountdownCue | null {
  return countdownCue({
    countdownTime: LONG_COUNTDOWN,
    timeLeft: milliseconds(timeLeft),
    countdownTo,
  });
}

describe('CUE_LEAD', () => {
  it('starts every cue one second early', () => {
    expect(CUE_LEAD).toBe(1000);
  });
});

describe('ANNOUNCEMENT_WINDOW', () => {
  it('announces the next Intervall at most five seconds ahead', () => {
    expect(ANNOUNCEMENT_WINDOW).toBe(5000);
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

  it('only starts a countdown under two seconds, announcing nothing', () => {
    expect(
      countdownCue({
        countdownTime: milliseconds(400),
        timeLeft: milliseconds(400),
        countdownTo: 'recovery',
      })
    ).toEqual({
      kind: 'start',
      secondsLeft: 0,
      countdownTo: 'recovery',
    });
  });
});

describe('countdownCue of a countdown starting inside its window', () => {
  /** each cue as `kind second @ ms left`, in the order the countdown sounds them */
  function scheduleOf(countdownTime: number): string[] {
    const schedule: string[] = [];
    let previous: CountdownCue | null = null;
    for (let timeLeft = countdownTime; timeLeft >= 0; timeLeft -= 1) {
      const cue = countdownCue({
        countdownTime: milliseconds(countdownTime),
        timeLeft: milliseconds(timeLeft),
        countdownTo: 'sprint',
      });
      if (cue && !sameCue(previous, cue)) {
        schedule.push(`${cue.kind} ${cue.secondsLeft} @ ${timeLeft}`);
      }
      previous = cue;
    }
    return schedule;
  }

  it('gives the Vorlauf of 5 s a lead before its first beep', () => {
    expect(scheduleOf(5000)).toEqual([
      'announcement 4 @ 4999',
      'beep 3 @ 3999',
      'beep 2 @ 2999',
      'beep 1 @ 1999',
      'start 0 @ 999',
    ]);
  });

  it('stays silent until the announcement is due', () => {
    expect(
      countdownCue({
        countdownTime: milliseconds(5000),
        timeLeft: milliseconds(5000),
        countdownTo: 'sprint',
      })
    ).toBeNull();
  });

  it('announces the whole seconds a 5.5 s countdown leaves after the lead', () => {
    expect(scheduleOf(5500)).toEqual([
      'announcement 4 @ 4999',
      'beep 3 @ 3999',
      'beep 2 @ 2999',
      'beep 1 @ 1999',
      'start 0 @ 999',
    ]);
  });

  it('announces a 3 s Intervall two seconds ahead', () => {
    expect(scheduleOf(3000)).toEqual([
      'announcement 2 @ 2999',
      'beep 1 @ 1999',
      'start 0 @ 999',
    ]);
  });

  it('still announces a countdown of exactly 2 s', () => {
    expect(scheduleOf(2000)).toEqual([
      'announcement 1 @ 1999',
      'start 0 @ 999',
    ]);
  });

  it('only starts a countdown of 1 s', () => {
    expect(scheduleOf(1000)).toEqual(['start 0 @ 999']);
  });

  it.each([6000, 60_000])(
    'keeps the five-second window of a %i ms countdown',
    (countdownTime) => {
      expect(scheduleOf(countdownTime)).toEqual([
        'announcement 5 @ 5999',
        'beep 4 @ 4999',
        'beep 3 @ 3999',
        'beep 2 @ 2999',
        'beep 1 @ 1999',
        'start 0 @ 999',
      ]);
    }
  );
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

  it('names a single second in the singular', () => {
    expect(
      cueSound(
        { kind: 'announcement', secondsLeft: 1, countdownTo: 'sprint' },
        'Sprinten'
      ).text
    ).toBe('Sprinten in 1 Sekunde!');
  });

  it('counts the last second of the training in the singular', () => {
    expect(
      cueSound(
        { kind: 'announcement', secondsLeft: 1, countdownTo: 'finished' },
        'Fertig'
      ).text
    ).toBe('Noch 1 Sekunde!');
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
