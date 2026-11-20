import {
  RELAY_COLLECTION,
  RELAY_DOC_ID,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { RELAY_TTL_S } from '../config';
import { fetchRelay, type TurnKey } from './fetch-relay';

/**
 * Fresh credentials for the TURN relay into `relay/turn` (ADR 0020), valid
 * {@link RELAY_TTL_S} from `now`: what `refreshRelay` runs every 30
 * minutes, so a reader always gets half of that at least. Throws when
 * Cloudflare refuses, leaving the last credentials until they expire.
 */
export async function refreshRelay(
  db: Firestore,
  key: TurnKey,
  fetchFn: typeof fetch,
  now: number
): Promise<{ expireAt: number }> {
  const entry = await fetchRelay(key, RELAY_TTL_S, fetchFn);
  const expireAt = now + RELAY_TTL_S * 1000;
  await db
    .collection(RELAY_COLLECTION)
    .doc(RELAY_DOC_ID)
    .set({
      ...entry,
      expireAt: Timestamp.fromMillis(expireAt),
      refreshedAt: Timestamp.fromMillis(now),
    });
  return { expireAt };
}
