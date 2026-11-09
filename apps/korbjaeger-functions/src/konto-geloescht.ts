import {
  DELETED_ACCOUNTS_COLLECTION,
  LEGACY_SELECTIONS_COLLECTION,
  SELECTIONS_COLLECTION,
} from '@wolsok/feat-korbjaeger-collections';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { GRABSTEIN_DAUER_MS } from './config';

/**
 * Deletes what Korbjäger keeps of the account `uid` once its Auth user is
 * deleted: `selections/{uid}`, with Meine Teams, the Kinder and the
 * Vereinsfarben, and `auswahl/{uid}`, where a selection of before #2966 was
 * never moved. The client deleted them already before the account, but
 * another device signed in to the account keeps a valid token for up to an
 * hour and may write anew. So the tombstone goes first: from then on the
 * rules refuse that uid every request on its selection, and the deletion
 * after it removes whatever a write before it stored.
 *
 * Every step is idempotent, so a retry ends the same however far the
 * failed run got; the tombstone's `expireAt` is counted from the last run.
 */
export async function kontoGeloescht(
  db: Firestore,
  uid: string,
  now: number = Date.now()
): Promise<void> {
  await db
    .collection(DELETED_ACCOUNTS_COLLECTION)
    .doc(uid)
    .set({ expireAt: Timestamp.fromMillis(now + GRABSTEIN_DAUER_MS) });
  await Promise.all([
    db.collection(SELECTIONS_COLLECTION).doc(uid).delete(),
    db.collection(LEGACY_SELECTIONS_COLLECTION).doc(uid).delete(),
  ]);
}
