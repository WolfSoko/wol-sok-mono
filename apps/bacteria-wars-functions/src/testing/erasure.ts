import type { Firestore } from 'firebase-admin/firestore';
import type { Realtime } from '../admin/realtime';
import type { ErasureContext } from '../erasure/context';
import { fakeRealtime } from './fake-realtime';

/** An erasure of a guest's account at `now` - no ban tombstone. */
export function erasureAt(
  db: Firestore,
  now: number,
  realtime: Realtime = fakeRealtime()
): ErasureContext {
  return { db, realtime, now, tombstone: null };
}
