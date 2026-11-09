import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  CHOICES_COLLECTION,
  DELETED_ACCOUNTS_COLLECTION,
  TOMBSTONE_DURATION_MS,
} from '@wolsok/feat-shared-korbjaeger-account';

/**
 * Deletes what Korbjäger keeps of the account `uid` once its Auth user is
 * deleted: `auswahl/{uid}`, with Meine Teams, the Kinder and the
 * Vereinsfarben. The client deleted it already before the account, but
 * another device signed in to the account keeps a valid token for up to an
 * hour and may write it anew. So the tombstone goes first: from then on the
 * rules refuse that uid every request on its Auswahl, and the deletion after
 * it removes whatever a write before it stored.
 *
 * Both steps are idempotent, so a retry ends the same however far the
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
    .set({ expireAt: Timestamp.fromMillis(now + TOMBSTONE_DURATION_MS) });
  await db.collection(CHOICES_COLLECTION).doc(uid).delete();
}
