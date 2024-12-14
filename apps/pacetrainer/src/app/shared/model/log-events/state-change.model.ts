import { TrainingRunnerState } from '../../training-runner/training-runner.state';
import { CountdownModel } from '../training/countdown.model';
import { CurrentIntervalDataModel } from '../training/current-interval-data.model';

type IntervalEvent = CurrentIntervalDataModel['name'];

type ToCountdownStateChange = 'countdownStart' | 'countdownEnd';

type ToStateChange =
  | TrainingRunnerState
  | IntervalEvent
  | 'endTraining'
  | 'startTraining'
  | ToCountdownStateChange;

export interface TrainingStateChangeBase {
  to: ToStateChange;
}

export interface SimpleStateChange extends TrainingStateChangeBase {
  type: 'simple';
}

export interface IntervalStateChange extends TrainingStateChangeBase {
  to: IntervalEvent;
  type: 'interval';
  params: Omit<CurrentIntervalDataModel, 'name'>;
}

export interface CountdownStateChange extends TrainingStateChangeBase {
  to: ToCountdownStateChange;
  type: 'countdown';
  params?: CountdownModel;
}

export type TrainingStateChange =
  | SimpleStateChange
  | IntervalStateChange
  | CountdownStateChange;

export function simpleStateChange(to: ToStateChange): SimpleStateChange {
  return { to, type: 'simple' };
}

export function intervalStateChange(
  to: IntervalStateChange['to'],
  params: IntervalStateChange['params']
): IntervalStateChange {
  // make sure only known properties are passed
  const {
    elapsedDuration,
    duration,
    leftDuration,
    isLast,
    index,
    leftTotalDuration,
    elapsedTrainingTime,
    repetitionCount,
    totalRepetitionCount,
    countdown,
    nextIntervalName,
  } = params;
  return {
    to,
    type: 'interval',
    params: {
      elapsedDuration,
      duration,
      leftDuration,
      isLast,
      index,
      leftTotalDuration,
      elapsedTrainingTime,
      repetitionCount,
      totalRepetitionCount,
      countdown,
      nextIntervalName,
    },
  };
}
export function countdownStateChange(
  to: CountdownStateChange['to'],
  params?: CountdownStateChange['params']
): CountdownStateChange {
  return { to, type: 'countdown', params };
}
