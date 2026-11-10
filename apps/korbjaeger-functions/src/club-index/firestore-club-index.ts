import {
  isOfferedAssociation,
  OFFERED_ASSOCIATION,
  parseAssociationClubsList,
  storedAssociationClubs,
} from '@wolsok/feat-shared-basketball-data';
import { CLUB_INDEX_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import type { AssociationId } from '@wolsok/feat-shared-basketball-data';
import type { Firestore } from 'firebase-admin/firestore';
import type { ClubIndexStore } from './run-club-index';

/** The field noting when a crawl started; a saved list drops it. */
const ATTEMPTED_AT = 'attemptedAt';

/**
 * The club index in Firestore: `clubIndex/{associationId}`, one list each,
 * with `attemptedAt` while a crawl started after it left none, and the
 * mark `OFFERED_ASSOCIATION` on every Verband the crawl noted, a list or
 * not yet. A document without a list is skipped (`parseAssociationClubs`),
 * and tells the server the index is still incomplete (`parseClubIndex`).
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
        ids: idsOf(docs),
        offered: idsOf(
          docs.filter((document) => isOfferedAssociation(document.data()))
        ),
      };
    },
    noteOffered: async (associations) => {
      const batch = db.batch();
      for (const association of associations) {
        batch.set(lists.doc(String(association)), OFFERED_ASSOCIATION, {
          merge: true,
        });
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

/** The Association ids of `docs`, skipping an id that is none. */
function idsOf(docs: readonly { readonly id: string }[]): Set<AssociationId> {
  return new Set(
    docs
      .map((document) => Number(document.id))
      .filter((id) => Number.isSafeInteger(id))
  );
}
