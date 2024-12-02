import { TrainingRunnerState } from '../../../features/training-runner/training-runner.state';
import { CurrentIntervalDataModel } from '../training/current-interval-data.model';

type IntervalEvent = CurrentIntervalDataModel['name'];

type StateChangeModel =
  | TrainingRunnerState
  | IntervalEvent
  | 'endTraining'
  | 'startTraining';

export interface TrainingStateChangeBase {
  to: StateChangeModel;
}

export interface SimpleStateChange extends TrainingStateChangeBase {
  type: 'simple';
}

export interface IntervalStateChange extends TrainingStateChangeBase {
  to: IntervalEvent;
  type: 'interval';
  params: Omit<CurrentIntervalDataModel, 'name'>;
}

export type TrainingStateChange = SimpleStateChange | IntervalStateChange;

export function simpleStateChange(to: StateChangeModel): SimpleStateChange {
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
    },
  };
}
