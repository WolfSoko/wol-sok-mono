import type {
  DocumentReference,
  Firestore,
  Query,
} from 'firebase-admin/firestore';
import { settleAll } from './settle';

/** Documents a query deletes per page. */
const PAGE = 300;

/**
 * Deletes the documents, through a `BulkWriter` (which retries what
 * Firestore turns away for a moment): every delete runs, then the first
 * failure is thrown. The number of documents.
 */
export async function deleteRefs(
  db: Firestore,
  refs: readonly DocumentReference[]
): Promise<number> {
  if (refs.length === 0) {
    return 0;
  }
  const writer = db.bulkWriter();
  await settleAll([...refs.map((ref) => writer.delete(ref)), writer.close()]);
  return refs.length;
}

/** Deletes what the query finds, page by page. The number of documents. */
export async function deleteAll(db: Firestore, query: Query): Promise<number> {
  let deleted = 0;
  for (;;) {
    const page = await query.select().limit(PAGE).get();
    deleted += await deleteRefs(
      db,
      page.docs.map((doc) => doc.ref)
    );
    if (page.size < PAGE) {
      return deleted;
    }
  }
}

/**
 * The rooms nobody took yet in which the player has one of `roles` -
 * `host`, `guest`. A taken room's stub stays: the other player's report
 * of the match is checked against it.
 */
export async function openRoomsOf(
  db: Firestore,
  uid: string,
  roles: readonly ('host' | 'guest')[]
): Promise<DocumentReference[]> {
  const found = await Promise.all(
    roles.map((role) =>
      db.collection('rooms').where(role, '==', uid).select('taken').get()
    )
  );
  return [
    ...new Map(
      found
        .flatMap((rooms) => rooms.docs)
        .filter((doc) => doc.get('taken') !== true)
        .map((doc) => [doc.id, doc.ref])
    ).values(),
  ];
}
