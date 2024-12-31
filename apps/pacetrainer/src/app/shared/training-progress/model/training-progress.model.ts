import { Milliseconds, ZERO_MS } from '../../model/constants/time-utils';
import {
  createElapsedDuration,
  updateElapsedDuration,
  WithElapsedDuration,
} from '../../model/timing';
import { IntervalWithDuration } from '../../model/training/interval';
import { TrainingConfigWithDuration } from '../../model/training/training-config-with.duration';
import { replaceAt } from '../../utils/array-util';
import {
  createExerciseProgress,
  ExerciseProgress,
  finishExercise,
  startExercise,
  updateExerciseElapsedDuration,
} from './exercise-progress.model';
import { StartAndEnd } from './start-and-end';
import { State } from './state';

export interface TrainingProgress
  extends WithElapsedDuration,
    StartAndEnd,
    State {
  training: TrainingConfigWithDuration;
  activeExerciseIndex: number;
  exercises: ExerciseProgress[];
}

export function createTrainingProgress(
  training: TrainingConfigWithDuration
): TrainingProgress {
  return {
    training,
    activeExerciseIndex: -1,
    exercises: flattenTrainingExercises(training.exercises),
    timing: { ...createElapsedDuration(training.timing.duration, ZERO_MS) },
    state: 'clean',
  };
}

export function startTraining(training: TrainingProgress): TrainingProgress {
  const startAtDate = new Date();
  const activeExerciseIndex = 0;
  const currentExercise = training.exercises[activeExerciseIndex];
  const startedCurrentExercise = startExercise(
    currentExercise,
    ZERO_MS,
    startAtDate
  );
  return {
    ...training,
    activeExerciseIndex,
    state: 'started',
    startAtDate: startAtDate,
    exercises: replaceAt(training.exercises, 0, startedCurrentExercise),
  };
}

export function activateNextExercise(
  training: TrainingProgress,
  elapsedTrainingDuration: Milliseconds
): TrainingProgress {
  const activeExerciseIndex: number = training.activeExerciseIndex;
  const endAtDate = new Date();
  const currentExercise = getActiveExercise(training);
  const finishedCurrentExercise = finishExercise(
    currentExercise,
    elapsedTrainingDuration,
    endAtDate
  );

  const nextExercise = findNextExercise(training);
  if (nextExercise == null) {
    throw new Error('No more exercises available');
  }

  const updateNextExercise = startExercise(
    nextExercise,
    elapsedTrainingDuration,
    endAtDate
  );
  return {
    ...training,
    activeExerciseIndex: activeExerciseIndex + 1,
    exercises: replaceAt(
      training.exercises,
      activeExerciseIndex,
      finishedCurrentExercise,
      updateNextExercise
    ),
  };
}

export function progressElapsedTrainingTime(
  training: TrainingProgress,
  elapsedTrainingTime: Milliseconds
) {
  const activeExercise = getActiveExercise(training);

  return {
    ...training,
    timing: updateElapsedDuration(training.timing, elapsedTrainingTime),
    exercises: replaceAt(
      training.exercises,
      training.activeExerciseIndex,
      updateExerciseElapsedDuration(activeExercise, elapsedTrainingTime)
    ),
  };
}

export function finishTraining(
  training: TrainingProgress,
  elapsedTrainingTime: Milliseconds
): TrainingProgress {
  console.log('finishTraining', training.state);

  if (!['started', 'finished', 'clean'].includes(training.state)) {
    throw new Error("Can't finish training because it has not started");
  }

  const endAtDate = new Date();
  const activeExercise: ExerciseProgress = getActiveExercise(training);

  if (activeExercise) {
    const finishedActiveExercise = finishExercise(
      activeExercise,
      elapsedTrainingTime,
      endAtDate
    );

    return {
      ...training,
      state: 'finished',
      endAtDate,
      exercises: replaceAt(
        training.exercises,
        training.activeExerciseIndex,
        finishedActiveExercise
      ),
    };
  }

  return {
    ...training,
    state: 'finished',
    endAtDate,
  };
}

export function getActiveExercise(
  training: TrainingProgress
): ExerciseProgress {
  return training.exercises[training.activeExerciseIndex];
}

export function findNextExercise(
  training: TrainingProgress
): ExerciseProgress | null {
  return training.exercises.at(training.activeExerciseIndex + 1) ?? null;
}

function flattenInterval(exercise: IntervalWithDuration): ExerciseProgress[] {
  const result = [];
  for (let i = 0; i < exercise.repetitions; i++) {
    result.push(
      // recursive call to flattenTrainingExercises if interval contains another interval
      ...flattenTrainingExercises(exercise.exercises)
    );
  }
  return result;
}

function flattenTrainingExercises(
  exercises: TrainingConfigWithDuration['exercises']
): ExerciseProgress[] {
  return exercises.reduce((prev, exercise) => {
    if (exercise.type === 'intervalWithDuration') {
      return [...prev, ...flattenInterval(exercise)];
    }
    return [...prev, createExerciseProgress(exercise)];
  }, [] as ExerciseProgress[]);
}
