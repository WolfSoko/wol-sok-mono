import { ExerciseWithDuration } from './excercise';
import { IntervalWithDuration } from './interval';
import { calcTotalDuration, createDuration, WithDuration } from '../timing';

export interface TrainingConfigWithDuration extends WithDuration {
  type: 'trainingWithDuration';
  exercises: (ExerciseWithDuration | IntervalWithDuration)[];
}

export function createTrainingWithDuration(
  exercises: TrainingConfigWithDuration['exercises']
): TrainingConfigWithDuration {
  return {
    type: 'trainingWithDuration',
    exercises,
    timing: createDuration(
      calcTotalDuration(exercises.map(({ timing }) => timing))
    ),
  };
}
