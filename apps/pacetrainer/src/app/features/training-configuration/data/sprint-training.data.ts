import { Milliseconds } from '@wolsok/utils-time';

export type SprintTrainingData = {
  recoveryTime: Milliseconds;
  sprintTime: Milliseconds;
  repetitions: number;
  totalTime: Milliseconds;
};
