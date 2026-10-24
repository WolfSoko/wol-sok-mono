import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Query,
  WriteBatch,
} from 'firebase-admin/firestore';

/** Writes per batch and documents per page - under Firestore's 500. */
const PAGE = 300;
/** Documents per `getAll` at most. */
const GET_ALL = 100;

/** Deletes every document a query finds, a page at a time. */
export async function deleteQuery(db: Firestore, query: Query): Promise<void> {
  for (;;) {
    const page = await query.limit(PAGE).get();
    if (page.empty) {
      return;
    }
    const batch = db.batch();
    page.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (page.size < PAGE) {
      return;
    }
  }
}

/** Writes something for each item, in batches of a page each. */
export async function inBatches<T>(
  db: Firestore,
  items: readonly T[],
  write: (batch: WriteBatch, item: T) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += PAGE) {
    const batch = db.batch();
    items.slice(i, i + PAGE).forEach((item) => write(batch, item));
    await batch.commit();
  }
}

/** Reads any number of documents, a hundred per `getAll`. */
export async function getAllChunked(
  db: Firestore,
  refs: readonly DocumentReference[]
): Promise<DocumentSnapshot[]> {
  const snapshots: DocumentSnapshot[] = [];
  for (let i = 0; i < refs.length; i += GET_ALL) {
    snapshots.push(...(await db.getAll(...refs.slice(i, i + GET_ALL))));
  }
  return snapshots;
}
