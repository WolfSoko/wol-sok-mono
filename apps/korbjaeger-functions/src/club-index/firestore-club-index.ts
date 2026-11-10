import {
  parseAssociationClubsList,
  storedAssociationClubs,
} from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import type { Firestore } from 'firebase-admin/firestore';
import type { ClubIndexStore } from './run-club-index';

/** The field noting when a crawl started; a saved list drops it. */
const ATTEMPTED_AT = 'attemptedAt';

/** The field noting an offered Verband before its first crawl (#3005). */
const OFFERED_AT = 'offeredAt';

/**
 * The club index in Firestore: `clubIndex/{associationId}`, one list each,
 * with `attemptedAt` while a crawl started after it left none, and
 * `offeredAt` on an offered Verband not crawled yet. A document holding
 * only those is no list (`parseAssociationClubs` skips it), which tells
 * the server the index is still incomplete (`parseClubIndex`).
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
        ids: new Set(
          docs
            .map((document) => Number(document.id))
            .filter((id) => Number.isSafeInteger(id))
        ),
      };
    },
    noteOffered: async (associations, at) => {
      const batch = db.batch();
      for (const association of associations) {
        batch.set(
          lists.doc(String(association)),
          { [OFFERED_AT]: at },
          { merge: true }
        );
      }
      await batch.commit();
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
