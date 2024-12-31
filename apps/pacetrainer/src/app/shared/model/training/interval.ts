import { Milliseconds, mul } from '../constants/time-utils';
import { ExerciseWithDuration } from './excercise';
import { calcTotalDuration, createDuration, Duration } from '../timing';

export type WithRepetition = {
  activeRepetition: number | null;
  repetitions: number;
};

export interface IntervalWithDuration extends WithRepetition {
  type: 'intervalWithDuration';
  exercises: Array<ExerciseWithDuration>;
  timing: Duration;
}

export function createIntervalWithDuration(
  repetitions: number,
  ...exercises: IntervalWithDuration['exercises']
): IntervalWithDuration {
  return {
    type: 'intervalWithDuration',
    activeRepetition: 0,
    repetitions,
    exercises,
    timing: createDuration(calcIntervalDuration(repetitions, exercises)),
  };
}

function calcIntervalDuration(
  repetitions: number,
  exercises: IntervalWithDuration['exercises']
): Milliseconds {
  return mul(
    calcTotalDuration(exercises.map((exercise) => exercise.timing)),
    repetitions
  );
}
