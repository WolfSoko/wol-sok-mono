import { filter, firstValueFrom, type Observable } from 'rxjs';

/**
 * A Firestore timestamp in whole milliseconds - null for anything else;
 * with `numbers`, a finite number of ms as well (what the Realtime Database
 * and older documents hold).
 *
 * Floored, as the Admin SDK does: the browser SDK's `toMillis()` keeps the
 * microseconds of a server timestamp as a fraction, which no replay header
 * takes and which would change a seed hashed from the time (ADR 0012).
 */
export function millisOf(
  value: unknown,
  { numbers = false }: { numbers?: boolean } = {}
): number | null {
  if (typeof value === 'number') {
    return numbers && Number.isFinite(value) ? Math.floor(value) : null;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    const millis: unknown = value.toMillis();
    return typeof millis === 'number' && Number.isFinite(millis)
      ? Math.floor(millis)
      : null;
  }
  return null;
}

/** The uid of whoever plays, once someone does. */
export function signedIn(
  playerIds: Observable<string | null>
): Promise<string> {
  return firstValueFrom(
    playerIds.pipe(filter((uid): uid is string => uid !== null))
  );
}
