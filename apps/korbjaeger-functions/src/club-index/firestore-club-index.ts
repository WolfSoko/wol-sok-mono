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

/** Since when a Verband has had no list (#3022); a saved list drops it. */
const LISTLESS_SINCE = 'listlessSince';

/** The error of the last failed crawl (#3022); a saved list drops it. */
const LAST_ERROR = 'lastError';

/**
 * The club index in Firestore: `clubIndex/{associationId}`, one list each,
 * with `attemptedAt` while a crawl started after it left none (and, for a
 * Verband without a list, `listlessSince` and the failed crawl's
 * `lastError`), and the
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
        attempts: fieldOf(docs, ATTEMPTED_AT, isNumber),
        listlessSince: fieldOf(docs, LISTLESS_SINCE, isNumber),
        lastErrors: fieldOf(docs, LAST_ERROR, isString),
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
    markAttempt: async (association, at, listlessSince) => {
      await lists
        .doc(String(association))
        .set(
          listlessSince === undefined
            ? { [ATTEMPTED_AT]: at }
            : { [ATTEMPTED_AT]: at, [LISTLESS_SINCE]: listlessSince },
          { merge: true }
        );
    },
    markFailure: async (association, error) => {
      await lists
        .doc(String(association))
        .set({ [LAST_ERROR]: error }, { merge: true });
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

/** The values of `field` in `docs` by Association id, where `is` holds. */
function fieldOf<T>(
  docs: readonly { readonly id: string; get(field: string): unknown }[],
  field: string,
  is: (value: unknown) => value is T
): Map<AssociationId, T> {
  return new Map(
    docs.flatMap((document) => {
      const value = document.get(field);
      const id = Number(document.id);
      return is(value) && Number.isSafeInteger(id)
        ? [[id, value] as const]
        : [];
    })
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
