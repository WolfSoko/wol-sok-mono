import { distinctUntilChanged, MonoTypeOperatorFunction } from 'rxjs';

export const filterLessEqualOp: MonoTypeOperatorFunction<number> = distinctUntilChanged<number>(
  (lastT, nextT) => lastT >= nextT
);
