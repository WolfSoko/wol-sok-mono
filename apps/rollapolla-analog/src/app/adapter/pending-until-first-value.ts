import { Injector, PendingTasks } from '@angular/core';
import { MonoTypeOperatorFunction, Observable } from 'rxjs';

/** Longest the server waits for data before it renders the page without it. */
export const SSR_DATA_TIMEOUT_MS = 1500;

/**
 * Keeps the app unstable, so server rendering waits, until the source emits,
 * ends, or `timeoutMs` passed. A slow backend then delays the page by at most
 * `timeoutMs`; the browser fills in the data once it arrives.
 */
export function pendingUntilFirstValue<T>(
  injector: Injector,
  timeoutMs: number
): MonoTypeOperatorFunction<T> {
  const pendingTasks = injector.get(PendingTasks);
  return (source) =>
    new Observable<T>((subscriber) => {
      const removeTask = pendingTasks.add();
      const timer = setTimeout(removeTask, timeoutMs);
      const settle = (): void => {
        clearTimeout(timer);
        removeTask();
      };
      const subscription = source.subscribe({
        next: (value) => {
          settle();
          subscriber.next(value);
        },
        error: (error: unknown) => {
          settle();
          subscriber.error(error);
        },
        complete: () => {
          settle();
          subscriber.complete();
        },
      });
      return () => {
        settle();
        subscription.unsubscribe();
      };
    });
}
