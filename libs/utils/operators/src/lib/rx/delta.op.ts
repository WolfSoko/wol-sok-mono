import { map, Observable, pairwise, pipe, UnaryFunction } from 'rxjs';

export const deltaOp: UnaryFunction<Observable<number>, Observable<number>> = pipe(
  pairwise<number>(),
  map(([lastT, nextT]) => nextT - lastT)
);
