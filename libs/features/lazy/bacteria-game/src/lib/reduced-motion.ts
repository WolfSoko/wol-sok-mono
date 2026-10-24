import { Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Whether the system asks for less motion - following it as it changes.
 * Called in an injection context, like any signal from an observable.
 */
export function prefersReducedMotion(): Signal<boolean> {
  if (typeof matchMedia !== 'function') {
    return signal(false);
  }
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  return toSignal(
    fromEvent<MediaQueryListEvent>(query, 'change').pipe(
      map((event) => event.matches)
    ),
    { initialValue: query.matches }
  );
}
