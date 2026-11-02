/** The longest wait between two tries. */
const MAX_DELAY_MS = 60_000;

/**
 * Waits before the next try of something that failed `attempt` times:
 * until the device is online again when it is not, else a while, twice as
 * long each time up to a minute.
 */
export function beforeRetry(attempt: number): Promise<void> {
  if (globalThis.navigator?.onLine === false) {
    return new Promise((resolve) =>
      window.addEventListener('online', () => resolve(), { once: true })
    );
  }
  const delay = Math.min(1000 * 2 ** attempt, MAX_DELAY_MS);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** The code of a Firebase error, "" for anything else. */
export function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
}
