import {
  parseAssociationClubsList,
  storedAssociationClubs,
} from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import type { Firestore } from 'firebase-admin/firestore';
import type { ClubIndexStore } from './run-club-index';

/** The field noting when a crawl started; a saved list drops it. */
const ATTEMPTED_AT = 'attemptedAt';

/**
 * The club index in Firestore: `clubIndex/{associationId}`, one list each,
 * with `attemptedAt` while a crawl started after it left none. A document
 * holding only that is no list (`parseAssociationClubs` skips it).
 */
export function firestoreClubIndex(db: Firestore): ClubIndexStore {
  const lists = db.collection(CLUB_INDEX_COLLECTION);
  return {
    read: async () => {
      const { docs } = await lists.get();
      return {
        lists: parseAssociationClubsList(
          docs.map((document) => document.data())
        ),
        attempts: new Map(
          docs.flatMap((document) => {
            const at: unknown = document.get(ATTEMPTED_AT);
            const id = Number(document.id);
            return typeof at === 'number' && Number.isSafeInteger(id)
              ? [[id, at] as const]
              : [];
          })
        ),
      };
    },
    markAttempt: async (association, at) => {
      await lists
        .doc(String(association))
        .set({ [ATTEMPTED_AT]: at }, { merge: true });
    },
    save: async (list) => {
      await lists
        .doc(String(list.association.id))
        .set(storedAssociationClubs(list));
    },
    remove: async (association) => {
      await lists.doc(String(association)).delete();
    },
  };
}
