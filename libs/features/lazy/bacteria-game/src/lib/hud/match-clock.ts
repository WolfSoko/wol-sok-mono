import type { TranslationKey } from '../i18n/dictionaries';
import { clock } from '../state/fixed-tick';

/** The last seconds of a timed level, when its clock turns red. */
export const RUNNING_OUT_SEC = 10;

/**
 * What the match clock shows: the time left on a timed level (its
 * `secondsLeft`), else the time played - "1:05".
 */
export function matchClockText(
  secondsLeft: number | null,
  gameSeconds: number
): string {
  return clock(secondsLeft ?? gameSeconds);
}

/** What the clock tells - the time left on a timed level, else the time played. */
export function matchClockLabel(secondsLeft: number | null): TranslationKey {
  return secondsLeft === null ? 'stage.hud.gameTime' : 'stage.hud.timeLeft';
}

/** True in the last seconds of a timed match, while it is on. */
export function isTimeRunningOut(
  running: boolean,
  secondsLeft: number | null
): boolean {
  return running && (secondsLeft ?? Infinity) <= RUNNING_OUT_SEC;
}
