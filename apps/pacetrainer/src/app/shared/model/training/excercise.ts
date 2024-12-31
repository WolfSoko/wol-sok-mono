import { Milliseconds } from '../constants/time-utils';
import { createDuration, Duration } from '../timing';

export type ExerciseType =
  | 'sprintWithDuration'
  | 'freeRunning'
  | 'freeRunningWithDuration'
  | 'recoveryWithDuration';

export interface Exercise {
  type: ExerciseType;
}

export interface ExerciseWithDuration extends Exercise {
  timing: Duration;
}

export interface SprintWithDuration extends ExerciseWithDuration {
  type: 'sprintWithDuration';
}

export function createSprintExercise(
  duration: Milliseconds
): SprintWithDuration {
  return {
    type: 'sprintWithDuration',
    timing: createDuration(duration),
  };
}

export interface FreeRunningWithDuration extends ExerciseWithDuration {
  type: 'freeRunningWithDuration';
}

export interface FreeRunning extends Exercise {
  type: 'freeRunning';
}

export interface RecoveryWithDuration extends ExerciseWithDuration {
  type: 'recoveryWithDuration';
}

export function createRecoveryExercise(
  duration: Milliseconds
): RecoveryWithDuration {
  return {
    type: 'recoveryWithDuration',
    timing: createDuration(duration),
  };
}
