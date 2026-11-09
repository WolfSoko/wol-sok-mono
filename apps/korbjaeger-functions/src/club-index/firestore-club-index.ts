import {
  parseAssociationClubs,
  storedAssociationClubs,
  type AssociationClubs,
} from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import type { Firestore } from 'firebase-admin/firestore';
import type { ClubIndexStore } from './run-club-index';

/** The club index in Firestore: `clubIndex/{associationId}`, one list each. */
export function firestoreClubIndex(db: Firestore): ClubIndexStore {
  const lists = db.collection(CLUB_INDEX_COLLECTION);
  return {
    all: async () =>
      (await lists.get()).docs
        .map((document) => parseAssociationClubs(document.data()))
        .filter((list): list is AssociationClubs => list !== undefined),
    save: async (list) => {
      await lists
        .doc(String(list.association.id))
        .set(storedAssociationClubs(list));
    },
  };
}
