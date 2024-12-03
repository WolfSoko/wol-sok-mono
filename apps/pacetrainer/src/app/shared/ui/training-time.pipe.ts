import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import {
  ge,
  gt,
  hours,
  hToMs,
  milliseconds,
  minutes,
  mToMs,
  seconds,
  sToMs,
} from '../model/constants/time-utils';

@Pipe({
  name: 'trainingTime',
  standalone: true,
})
export class TrainingTimePipe implements PipeTransform {
  datePipe = new DatePipe('en-US', 'UTC');

  transform(timeInMs: Date | number | null | undefined): string | null {
    if (timeInMs == null) {
      return null;
    }
    // we use fixed timezone because timeInMS is always from 0 UTC
    return this.datePipe.transform(timeInMs, this.format(timeInMs));
  }

  private format(timeInMS: number | Date): string {
    const ms = milliseconds(
      timeInMS instanceof Date ? timeInMS.getTime() : timeInMS
    );

    if (ge(ms, hToMs(hours(1)))) {
      return `H:mm:ss 'h'`;
    }
    if (ge(ms, mToMs(minutes(1)))) {
      return `m:ss 'min'`;
    }
    if (ge(ms, sToMs(seconds(1)))) {
      return `s 'sec'`;
    }
    return `s,S 'sec'`;
  }
}
