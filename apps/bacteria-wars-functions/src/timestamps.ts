import { Timestamp } from 'firebase-admin/firestore';

/**
 * A Firestore Timestamp in ms, null for anything else - the `toMillis` the
 * engine's record parsers (`parseBan`) take.
 */
export function timestampMillis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}
