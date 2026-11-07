import type { Firestore } from 'firebase-admin/firestore';
import type { Realtime } from '../admin/realtime';

/** The stores a player's data lives in. */
export interface Stores {
  db: Firestore;
  realtime: Realtime;
}

/** What an erasure goes by (`erasePart`, `erasePlayer`). */
export interface ErasureContext extends Stores {
  now: number;
  /**
   * The account's ban tombstone id, null without a Google provider -
   * always null for a guest. Only the `account` part reads it.
   */
  tombstone: string | null;
  /**
   * Told instead of lowering `stats/accounts`, when the caller sums the
   * accounts it erased and lowers the count once (`guestCleanup`).
   */
  uncounted?: () => void;
}
