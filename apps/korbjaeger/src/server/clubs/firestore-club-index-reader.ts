import { parseAssociationClubsList } from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import type { ClubIndexReader } from './club-index-response';

/**
 * Reads the club index from the project's Firestore with the function's
 * own service account (the rules give clients no access). `firebase-admin`
 * loads on the first read only, so the DBB proxy's routes start without
 * it. A list it cannot read is skipped.
 */
export const firestoreClubIndexReader: ClubIndexReader = async () => {
  const [{ getApps, initializeApp }, { getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ]);
  const app = getApps()[0] ?? initializeApp();
  const lists = await getFirestore(app).collection(CLUB_INDEX_COLLECTION).get();
  return parseAssociationClubsList(
    lists.docs.map((document) => document.data())
  );
};
