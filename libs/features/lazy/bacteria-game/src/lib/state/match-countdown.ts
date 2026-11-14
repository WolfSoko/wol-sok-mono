import { InjectionToken } from '@angular/core';

/**
 * How many seconds a match the stage starts counts down before its first
 * tick. Ranked attempts allow `COUNTDOWN_MS` for it (ADR 0012), which this
 * stays within.
 */
export const DEFAULT_MATCH_COUNTDOWN_SECONDS = 3;

/** The time one number of the countdown shows. */
export const COUNTDOWN_STEP_MS = 1000;

/**
 * The seconds of the countdown before a match - 0 starts it at once, as
 * the specs that drive the match tick by tick do.
 */
export const MATCH_COUNTDOWN_SECONDS = new InjectionToken<number>(
  'MATCH_COUNTDOWN_SECONDS',
  { providedIn: 'root', factory: () => DEFAULT_MATCH_COUNTDOWN_SECONDS }
);
