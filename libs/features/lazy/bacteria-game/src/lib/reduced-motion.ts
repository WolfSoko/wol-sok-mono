import { Signal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';
import { map } from 'rxjs/operators';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the system asks for less motion - following it as it changes.
 * Called in an injection context, like any signal from an observable.
 */
export function prefersReducedMotion(): Signal<boolean> {
  if (typeof matchMedia !== 'function') {
    return signal(false);
  }
  const query = matchMedia(QUERY);
  return toSignal(
    fromEvent<MediaQueryListEvent>(query, 'change').pipe(
      map((event) => event.matches)
    ),
    { initialValue: query.matches }
  );
}

/**
 * Whether the system asks for less motion right now - for code outside an
 * injection context that decides once, like a purchase's animation.
 */
export function reducedMotionNow(): boolean {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
}
