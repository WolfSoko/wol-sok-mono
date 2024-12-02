import { Seconds } from '../../../shared/model/constants/time-utils';

export type SprintTrainingData = {
  recoveryTime: Seconds;
  sprintTime: Seconds;
  repetitions: number;
  totalTime: Seconds;
};
