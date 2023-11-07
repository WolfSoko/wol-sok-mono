import { TimeInterval as RxTimeInterval } from 'rxjs';

export class TimeInterval<T> implements RxTimeInterval<T> {
  constructor(
    public readonly value: T,
    public interval: number
  ) {}
}
