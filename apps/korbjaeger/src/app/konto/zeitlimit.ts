/**
 * `arbeit`, or `beiAblauf()` where it takes longer than `ms`; the timer is
 * cleared either way, so none outlives the race. `arbeit` itself runs on.
 */
export async function mitZeitlimit<T>(
  arbeit: Promise<T>,
  ms: number,
  beiAblauf: () => T
): Promise<T> {
  let zeitgeber: ReturnType<typeof setTimeout> | undefined;
  const abgelaufen = new Promise<T>((weiter) => {
    zeitgeber = setTimeout(() => weiter(beiAblauf()), ms);
  });
  try {
    return await Promise.race([arbeit, abgelaufen]);
  } finally {
    clearTimeout(zeitgeber);
  }
}
