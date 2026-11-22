import {
  div,
  milliseconds,
  Milliseconds,
  SECOND_IN_MS,
  Seconds,
  seconds,
  subtract,
} from '@wolsok/utils-time';
import { CountdownModel } from '../model/training/countdown.model';
import { CountdownTarget } from '../model/training/training-name';

/**
 * Every cue sounds this long before its second is left. Said at the app's
 * speech rate, "Jetzt Sprinten!" takes about a second, and the runner needs a
 * moment to react: starting it one second early lets the words end on the
 * start of the Intervall (#3098).
 */
export const CUE_LEAD = SECOND_IN_MS;

/** the next Intervall is announced at most this long before it starts */
export const ANNOUNCEMENT_WINDOW = milliseconds(5000);

/** announcement opens the window, beeps count it down, start ends it */
export type CueKind = 'announcement' | 'beep' | 'start';

export interface CountdownCue {
  readonly kind: CueKind;
  /** the seconds left that this cue stands for */
  readonly secondsLeft: number;
  readonly countdownTo: CountdownTarget;
}

export interface CueSound {
  readonly frequency: number;
  readonly length: Seconds;
  readonly text: string | undefined;
}

const TONES: Record<CueKind, Omit<CueSound, 'text'>> = {
  announcement: { frequency: 440, length: seconds(0.4) },
  beep: { frequency: 880, length: seconds(0.4) },
  start: { frequency: 660, length: seconds(0.8) },
};

/** the second whose cue is due, one {@link CUE_LEAD} ahead of `timeLeft` */
export function cueSecond(timeLeft: Milliseconds): number {
  return Math.floor(div(subtract(timeLeft, CUE_LEAD), SECOND_IN_MS)) + 1;
}

/** the cue due at this point of the countdown, if any */
export function countdownCue({
  countdownTime,
  timeLeft,
  countdownTo,
}: CountdownModel): CountdownCue | null {
  const secondsLeft = cueSecond(timeLeft);
  const kind = cueKindOf(secondsLeft, announcedSeconds(countdownTime));
  return kind ? { kind, secondsLeft, countdownTo } : null;
}

/**
 * The seconds the announcement names: at most {@link ANNOUNCEMENT_WINDOW},
 * and one {@link CUE_LEAD} short of a countdown that starts inside it (the
 * Vorlauf, a short Intervall), so the announcement gets its lead before the
 * first beep as in a long Intervall (#3110).
 */
function announcedSeconds(countdownTime: Milliseconds): number {
  const window = milliseconds(
    Math.min(ANNOUNCEMENT_WINDOW, subtract(countdownTime, CUE_LEAD))
  );
  return Math.max(0, Math.floor(div(window, SECOND_IN_MS)));
}

function cueKindOf(secondsLeft: number, windowSeconds: number): CueKind | null {
  if (secondsLeft === 0) {
    return 'start';
  }
  if (secondsLeft === windowSeconds) {
    return 'announcement';
  }
  if (secondsLeft > 0 && secondsLeft < windowSeconds) {
    return 'beep';
  }
  return null;
}

/** what a cue sounds like; `name` is the next Intervall's spoken name */
export function cueSound(cue: CountdownCue, name: string): CueSound {
  return { ...TONES[cue.kind], text: cueText(cue, name) };
}

function cueText(
  { kind, secondsLeft, countdownTo }: CountdownCue,
  name: string
): string | undefined {
  const isEnd = countdownTo === 'finished';
  switch (kind) {
    case 'announcement':
      return isEnd
        ? `Noch ${secondsLeft} Sekunden!`
        : `${name} in ${secondsLeft} Sekunden!`;
    case 'start':
      return isEnd ? 'Training beendet. Gut gemacht!' : `Jetzt ${name}!`;
    case 'beep':
      return undefined;
  }
}

/** whether both stand for the same cue of the same countdown (or both for none) */
export function sameCue(
  previous: CountdownCue | null,
  next: CountdownCue | null
): boolean {
  return (
    previous?.kind === next?.kind &&
    previous?.secondsLeft === next?.secondsLeft &&
    previous?.countdownTo === next?.countdownTo
  );
}
