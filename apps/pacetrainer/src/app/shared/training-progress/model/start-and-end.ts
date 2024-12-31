import { Milliseconds } from '../../model/constants/time-utils';

export interface StartAndEnd {
  startAtDate?: Date;
  endAtDate?: Date;
}

export interface StartAndEndTrainingDuration {
  startAt?: Milliseconds;
  endAt?: Milliseconds;
}
