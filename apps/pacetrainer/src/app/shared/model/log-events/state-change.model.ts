import { TrainingProgress } from '../../training-progress/model/training-progress.model';
import { TrainingRunnerState } from '../../training-runner/training-runner.state';
import { CountdownModel } from '../training/countdown.model';
import { Exercise } from '../training/excercise';

type ExerciseTypeEvent = Exercise['type'];

type ToCountdownStateChange = 'countdownStart' | 'countdownEnd';

type ToStateChange =
  | TrainingRunnerState
  | ExerciseTypeEvent
  | 'endTraining'
  | 'startTraining'
  | ToCountdownStateChange;

export interface TrainingStateChangeBase {
  to: ToStateChange;
}

export interface SimpleStateChange extends TrainingStateChangeBase {
  type: 'simple';
}

export interface TrainingProgressChange extends TrainingStateChangeBase {
  to: ExerciseTypeEvent;
  type: 'trainingProgress';
  params: TrainingProgress;
}

export interface CountdownStateChange extends TrainingStateChangeBase {
  to: ToCountdownStateChange;
  type: 'countdown';
  params?: CountdownModel;
}

export type TrainingStateChange =
  | SimpleStateChange
  | TrainingProgressChange
  | CountdownStateChange;

export function simpleStateChange(to: ToStateChange): SimpleStateChange {
  return { to, type: 'simple' };
}

export function intervalStateChange(
  to: TrainingProgressChange['to'],
  params: TrainingProgressChange['params']
): TrainingProgressChange {
  // make sure only known properties are passed

  return {
    to,
    type: 'trainingProgress',
    params,
  };
}
export function countdownStateChange(
  to: CountdownStateChange['to'],
  params?: CountdownStateChange['params']
): CountdownStateChange {
  return { to, type: 'countdown', params };
}
