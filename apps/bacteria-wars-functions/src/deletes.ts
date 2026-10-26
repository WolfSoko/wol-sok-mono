import type {
  DocumentReference,
  Firestore,
  Query,
} from 'firebase-admin/firestore';

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
  const deletes = Promise.allSettled(refs.map((ref) => writer.delete(ref)));
  await writer.close();
  const failed = (await deletes).find((result) => result.status === 'rejected');
  if (failed !== undefined) {
    throw failed.reason;
  }
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
