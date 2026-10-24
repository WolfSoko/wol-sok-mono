import { MonoTypeOperatorFunction, retry, timer } from 'rxjs';

/** How long to wait before listening again after a listener failed. */
export const RETRY_DELAY_MS = 10_000;

/**
 * Logs each error with `message`, tells `onError`, and subscribes again
 * after {@link RETRY_DELAY_MS}, for as long as it takes.
 */
export function retryAfterDelay<T>(
  message: string,
  onError?: () => void
): MonoTypeOperatorFunction<T> {
  return retry({
    delay: (error: unknown) => {
      console.error(message, error);
      onError?.();
      return timer(RETRY_DELAY_MS);
    },
  });
}
