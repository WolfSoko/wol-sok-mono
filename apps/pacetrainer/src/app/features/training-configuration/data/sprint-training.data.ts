import { Milliseconds } from '../../../shared/model/constants/time-utils';

export type SprintTrainingData = {
  recoveryTime: Milliseconds;
  sprintTime: Milliseconds;
  repetitions: number;
  totalTime: Milliseconds;
};
