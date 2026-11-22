import { Milliseconds } from '@wolsok/utils-time';
import { CountdownTarget } from './training-name';

export interface CountdownModel {
  /** the length of the whole countdown: the Vorlauf or the current Intervall */
  countdownTime: Milliseconds;
  timeLeft: Milliseconds;
  countdownTo: CountdownTarget;
}
