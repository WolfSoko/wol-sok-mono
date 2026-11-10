import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  CHOICES_COLLECTION,
  DELETED_ACCOUNTS_COLLECTION,
  LEGACY_CHOICES_COLLECTION,
  LEGACY_DELETED_ACCOUNTS_COLLECTION,
  TOMBSTONE_DURATION_MS,
} from '@wolsok/feat-shared-korbjaeger-account';

/**
 * Deletes what Korbjäger keeps of the account `uid` once its Auth user is
 * deleted: `selections/{uid}`, with Meine Teams, the Kinder and the
 * Vereinsfarben, and `auswahl/{uid}`, where a selection of before #2966 was
 * never moved. The client deleted them already before the account, but
 * another device signed in to the account keeps a valid token for up to an
 * hour and may write anew. So the tombstone goes first (in both collections
 * while the rules of before #2966 may still be live): from then on the
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
  const tombstone = {
    expireAt: Timestamp.fromMillis(now + TOMBSTONE_DURATION_MS),
  };
  // both, until #2966's follow-up: the rules deployed may still be those
  // that know only the legacy collection
  await Promise.all(
    [DELETED_ACCOUNTS_COLLECTION, LEGACY_DELETED_ACCOUNTS_COLLECTION].map(
      (tombstones) => db.collection(tombstones).doc(uid).set(tombstone)
    )
  );
  await Promise.all([
    db.collection(CHOICES_COLLECTION).doc(uid).delete(),
    db.collection(LEGACY_CHOICES_COLLECTION).doc(uid).delete(),
  ]);
}
