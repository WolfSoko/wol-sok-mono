import { Milliseconds } from '../constants/time-utils';
import { TrainingName } from './training-name';

export type CurrentIntervalDataModel = {
  duration: Milliseconds;
  isLast: boolean;
  name: TrainingName;
  index: number;
  leftDuration: Milliseconds;
  elapsedDuration: Milliseconds;
  repetitionCount: number;
  totalRepetitionCount: number;
  leftTotalDuration: Milliseconds;
  elapsedTrainingTime: Milliseconds;
  nextIntervalName: TrainingName;
  countdown: Milliseconds;
};
