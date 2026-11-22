import { defer, Observable, of } from 'rxjs';
import { catchError, defaultIfEmpty, last, map } from 'rxjs/operators';

/**
 * Completes with one value once the vaporize effect `effect` sets up is
 * over, whatever it came to: it may finish without emitting, and an effect
 * that fails - even at once, while it is set up - is over too. The error is
 * logged and the stage goes on, so it never stays without a menu.
 */
export function effectOver(
  effect: () => Observable<unknown>
): Observable<void> {
  return defer(effect).pipe(
    catchError((error: unknown) => {
      console.error('The arena could not be vaporized', error);
      return of(undefined);
    }),
    defaultIfEmpty(undefined),
    last(),
    map(() => undefined)
  );
}
