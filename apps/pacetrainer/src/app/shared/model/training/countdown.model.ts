import { Milliseconds } from '../constants/time-utils';
import { TrainingName } from './training-name';

export interface CountdownModel {
  countdownTime: Milliseconds;
  countdownTo: TrainingName;
}