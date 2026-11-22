import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Claims a command document for one delivery of its trigger: Firestore
 * may deliver one create twice, and a command that must not run twice (a
 * one-time code, say) answers null from `runCommandDocument`'s `run` for
 * every delivery but the one this marks (`claimedAt`). False as well for a
 * command answered already, and for one deleted meanwhile.
 */
export async function claimCommand(
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
