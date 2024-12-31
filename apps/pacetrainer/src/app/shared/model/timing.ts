import { add, Milliseconds, subtract, ZERO_MS } from './constants/time-utils';

export interface Duration {
  duration: Milliseconds;
}

export interface ElapsedDuration extends Duration {
  elapsedDuration: Milliseconds;
  leftDuration: Milliseconds;
}

export interface WithDuration {
  timing: Duration;
}

export interface WithElapsedDuration {
  timing: ElapsedDuration;
}

export function createElapsedDuration(
  duration: Milliseconds,
  elapsedDuration: Milliseconds = ZERO_MS
): ElapsedDuration {
  return {
    elapsedDuration,
    ...createDuration(duration),
    leftDuration: subtract(duration, elapsedDuration),
  };
}

export function updateElapsedDuration(
  toUpdate: ElapsedDuration,
  elapsedDuration: Milliseconds
): ElapsedDuration {
  return createElapsedDuration(toUpdate.duration, elapsedDuration);
}
export function createDuration(duration: Milliseconds): Duration {
  return {
    duration,
  };
}

export function calcTotalDuration(durations: Duration[]) {
  return durations.reduce((acc, curr) => add(acc, curr.duration), ZERO_MS);
}
