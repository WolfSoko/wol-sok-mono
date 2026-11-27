import { inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { distinctUntilChanged, filter, map, of, switchMap, timer } from 'rxjs';

/** a navigation quicker than this shows no loading, so nothing flashes */
export const SLOW_NAVIGATION_MS = 150;

/**
 * Whether a navigation is still loading its page (a lazy route or a remote)
 * after `SLOW_NAVIGATION_MS`; false again once it ended, failed or was
 * cancelled. Call it in an injection context.
 */
export function navigationLoading(): Signal<boolean> {
  const navigating = inject(Router).events.pipe(
    filter(
      (event) =>
        event instanceof NavigationStart ||
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
    ),
    map((event) => event instanceof NavigationStart),
    distinctUntilChanged(),
    switchMap((started) =>
      started ? timer(SLOW_NAVIGATION_MS).pipe(map(() => true)) : of(false)
    )
  );
  return toSignal(navigating, { initialValue: false });
}
