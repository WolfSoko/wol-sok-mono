import { Milliseconds } from '@wolsok/utils-time';
import { TrainingName } from './training-name';

export interface CountdownModel {
  countdownTime: Milliseconds;
  timeLeft: Milliseconds;
  countdownTo: TrainingName;
}
