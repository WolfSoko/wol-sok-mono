import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Claims a Play Games sign-in for this delivery of its trigger: Firestore
 * may deliver one create twice, and a second run with the same one-time
 * code would be refused by Google and overwrite the first run's result
 * (with its token) by `play-games-refused`. True for the one delivery that
 * marks it (`claimedAt`); false for any other, for a command answered
 * already, and for one the player deleted meanwhile.
 */
export async function claimSignIn(
  db: Firestore,
  path: string
): Promise<boolean> {
  const ref = db.doc(path);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (
      !snapshot.exists ||
      snapshot.get('claimedAt') !== undefined ||
      snapshot.get('result') !== undefined
    ) {
      return false;
    }
    tx.update(ref, { claimedAt: FieldValue.serverTimestamp() });
    return true;
  });
}
