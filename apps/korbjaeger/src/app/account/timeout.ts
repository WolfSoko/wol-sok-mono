/**
 * `work`, or `onTimeout()` where it takes longer than `ms`; the timer is
 * cleared either way, so none outlives the race. `work` itself runs on.
 */
export async function withTimeout<T>(
  work: Promise<T>,
  ms: number,
  onTimeout: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((proceed) => {
    timer = setTimeout(() => proceed(onTimeout()), ms);
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}
