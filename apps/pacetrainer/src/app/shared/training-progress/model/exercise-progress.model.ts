import {
  le,
  Milliseconds,
  subtract,
  ZERO_MS,
} from '../../model/constants/time-utils';
import { createElapsedDuration, WithElapsedDuration } from '../../model/timing';
import { Exercise, ExerciseWithDuration } from '../../model/training/excercise';
import { safeJsonStringify } from '../../utils/json-utils/json-utils';
import { StartAndEnd, StartAndEndTrainingDuration } from './start-and-end';
import { State } from './state';

export interface ExerciseProgress
  extends WithElapsedDuration,
    StartAndEndTrainingDuration,
    StartAndEnd,
    State {
  exercise: Exercise;
}

export function createExerciseProgress(
  exercise: ExerciseWithDuration
): ExerciseProgress {
  return {
    exercise,
    timing: createElapsedDuration(exercise.timing.duration, ZERO_MS),
    state: 'clean',
  };
}

export function startExercise(
  exercise: ExerciseProgress,
  startAt: Milliseconds,
  startAtDate: Date = new Date()
): ExerciseProgress {
  if (exercise.state === 'finished') {
    throw new Error(
      'Cannot start already finished exercise: ' + safeJsonStringify(exercise)
    );
  }
  return updateExercise(exercise, {
    state: 'started',
    startAt,
    startAtDate,
  });
}

export function finishExercise(
  exercise: ExerciseProgress,
  elapsedTrainingTime: Milliseconds,
  endAt: Date = new Date()
): ExerciseProgress {
  if (!['started', 'finished'].includes(exercise.state)) {
    throw new Error(
      'Cannot finish not started exercise: ' + safeJsonStringify(exercise)
    );
  }
  return updateExercise(
    exercise,
    { state: 'finished', endAt: elapsedTrainingTime, endAtDate: endAt },
    calcElapsedDurationFromTotalTrainingTime(exercise, elapsedTrainingTime)
  );
}

function calcElapsedDurationFromTotalTrainingTime(
  exercise: ExerciseProgress,
  elapsedTotalTrainingTime: Milliseconds
): Milliseconds {
  if (exercise.startAt == null) {
    throw new Error(
      'Could not calc elapsed duration of exercise because startAt is not set ' +
        safeJsonStringify(exercise)
    );
  }
  return subtract(elapsedTotalTrainingTime, exercise.startAt);
}

export function updateExerciseElapsedDuration(
  exercise: ExerciseProgress,
  elapsedTotalTrainingTime: Milliseconds
) {
  const elapsedDuration = calcElapsedDurationFromTotalTrainingTime(
    exercise,
    elapsedTotalTrainingTime
  );
  return updateExercise(exercise, {}, elapsedDuration);
}

export function updateExercise(
  baseExercise: ExerciseProgress,
  propsToUpdate: Partial<ExerciseProgress> = {},
  elapsedDuration?: Milliseconds
): ExerciseProgress {
  return {
    ...baseExercise,
    ...propsToUpdate,
    ...(elapsedDuration != null
      ? {
          timing: createElapsedDuration(
            baseExercise.timing.duration,
            elapsedDuration
          ),
        }
      : {}),
  };
}

export function isExerciseFinishedByTime(exercise: ExerciseProgress) {
  return le(exercise.timing.leftDuration, ZERO_MS);
}
