import {
  findNextExercise,
  getActiveExercise,
  TrainingProgress,
} from '../../training-progress/model/training-progress.model';
import { Milliseconds } from '../constants/time-utils';
import { Exercise } from './excercise';
import { TrainingName } from './training-name';

export type CurrentExerciseViewModel = {
  duration: Milliseconds | null;
  name: TrainingName;
  index: number;
  leftDuration: Milliseconds;
  elapsedDuration: Milliseconds;
  repetitionCount: number | null;
  totalRepetitionCount: number;
  leftTotalDuration: Milliseconds;
  elapsedTrainingTime: Milliseconds;
  nextIntervalName: TrainingName | null;
  countdown: boolean;
};

export function mapFromTrainingProgress(
  trainingProgress: TrainingProgress
): CurrentExerciseViewModel {
  const activeExercise = getActiveExercise(trainingProgress);
  const nextExercise = findNextExercise(trainingProgress);
  const leftDuration = activeExercise.timing.leftDuration;
  const countdown = !!nextExercise;

  return {
    duration: activeExercise.timing.duration,
    leftDuration,
    elapsedDuration: activeExercise.timing.elapsedDuration,
    repetitionCount: trainingProgress.activeExerciseIndex + 1,
    totalRepetitionCount: trainingProgress.exercises.length,
    leftTotalDuration: trainingProgress.timing.leftDuration,
    elapsedTrainingTime: trainingProgress.timing.elapsedDuration,
    nextIntervalName: nextExercise
      ? mapTrainingName(nextExercise.exercise.type)
      : null,
    name: mapTrainingName(activeExercise.exercise.type, trainingProgress.state),
    countdown,
    index: trainingProgress.activeExerciseIndex,
  };
}
export function mapTrainingName(
  type: Exercise['type'],
  state?: TrainingProgress['state']
): TrainingName {
  switch (state) {
    case 'clean':
      return 'getready';
    case 'finished':
      return 'finished';
  }
  switch (type) {
    case 'freeRunning':
    case 'freeRunningWithDuration':
      return 'running';
    case 'sprintWithDuration':
      return 'sprint';
    case 'recoveryWithDuration':
      return 'recovery';
  }
}
