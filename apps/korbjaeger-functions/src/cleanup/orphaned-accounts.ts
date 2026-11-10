import { type Firestore } from 'firebase-admin/firestore';
import {
  CHOICES_COLLECTION,
  LEGACY_CHOICES_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';
import { kontoGeloescht } from '../konto-geloescht';

/** The collections that hold an account's choices, keyed by its uid. */
const ACCOUNT_COLLECTIONS = [CHOICES_COLLECTION, LEGACY_CHOICES_COLLECTION];

/**
 * Which accounts Auth still knows. Its one adapter is `authAccounts`; the
 * specs pass a fake.
 */
export interface ExistingAccounts {
  /** The uids among `uids` whose Auth user no longer exists. */
  missing(uids: readonly string[]): Promise<ReadonlySet<string>>;
}

/** What a run found and did: counts only, never a uid (#2986). */
export interface OrphanCleanupReport {
  /** Documents listed, per collection. */
  readonly documentsListed: Readonly<Record<string, number>>;
  /** Accounts with a document but no Auth user. */
  readonly orphansFound: number;
  /** Orphans whose documents this run deleted: 0 in a dry run, fewer where a deletion failed. */
  readonly orphansDeleted: number;
}

interface OrphanSearch {
  readonly documentsListed: Readonly<Record<string, number>>;
  /** How many accounts have a document, each counted once. */
  readonly accounts: number;
  /** Each orphaned uid once, also where it has documents in both collections. */
  readonly orphans: readonly string[];
}

/**
 * Finds every account with a document in `ACCOUNT_COLLECTIONS` whose Auth
 * user is gone: left behind when a deletion ran while #2982 was being
 * deployed, or written anew by a device whose token was still valid.
 */
export async function findOrphanedAccounts(
  db: Firestore,
  accounts: ExistingAccounts
): Promise<OrphanSearch> {
  const uids = new Set<string>();
  const listed = await Promise.all(
    ACCOUNT_COLLECTIONS.map(async (collection) => {
      const refs = await db.collection(collection).listDocuments();
      refs.forEach((ref) => uids.add(ref.id));
      return [collection, refs.length];
    })
  );
  const missing = await accounts.missing([...uids]);
  return {
    documentsListed: Object.fromEntries(listed),
    accounts: uids.size,
    orphans: [...uids].filter((uid) => missing.has(uid)),
  };
}

/**
 * Deletes what orphaned accounts left, as the Auth deletion trigger does
 * (`kontoGeloescht`: the tombstone first, then `selections/{uid}`), and
 * then the account's document of before #2966, which the trigger no longer
 * knows (#2983), so a rerun ends the same. Without `deleteOrphans` it only counts (dry run). A failed
 * deletion is counted, not thrown, so the report says how far it got.
 */
export async function cleanUpOrphanedAccounts(
  db: Firestore,
  accounts: ExistingAccounts,
  { deleteOrphans }: { readonly deleteOrphans: boolean }
): Promise<OrphanCleanupReport> {
  const search = await findOrphanedAccounts(db, accounts);
  const report = (orphansDeleted: number): OrphanCleanupReport => ({
    documentsListed: search.documentsListed,
    orphansFound: search.orphans.length,
    orphansDeleted,
  });
  if (!deleteOrphans) {
    return report(0);
  }
  if (search.orphans.length > 0 && search.orphans.length === search.accounts) {
    // Firestore and Auth most likely are not the same project (one of them
    // an emulator): deleting would empty every living account
    throw new Error(
      `Auth knows none of the ${search.accounts} accounts with a document: ` +
        'are Firestore and Auth the same project? Nothing deleted.'
    );
  }
  let orphansDeleted = 0;
  for (const uid of search.orphans) {
    try {
      await kontoGeloescht(db, uid);
      await db.collection(LEGACY_CHOICES_COLLECTION).doc(uid).delete();
      orphansDeleted++;
    } catch {
      // counted as not deleted; the error may name the uid, so it is not printed
    }
  }
  return report(orphansDeleted);
}
