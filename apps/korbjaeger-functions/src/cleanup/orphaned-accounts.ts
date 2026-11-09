import { type Firestore } from 'firebase-admin/firestore';
import {
  CHOICES_COLLECTION,
  LEGACY_CHOICES_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';
import { kontoGeloescht } from '../konto-geloescht';

/** The collections that hold an account's choices, keyed by its uid. */
export const ACCOUNT_COLLECTIONS = [
  CHOICES_COLLECTION,
  LEGACY_CHOICES_COLLECTION,
] as const;

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
  /** Documents read, per collection of `ACCOUNT_COLLECTIONS`. */
  readonly documentsRead: Readonly<Record<string, number>>;
  /** Accounts with a document but no Auth user. */
  readonly orphansFound: number;
  /** Orphans whose documents this run deleted: 0 in a dry run. */
  readonly orphansDeleted: number;
}

export interface OrphanSearch {
  readonly documentsRead: Readonly<Record<string, number>>;
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
  const documentsRead: Record<string, number> = {};
  const uids = new Set<string>();
  for (const collection of ACCOUNT_COLLECTIONS) {
    const refs = await db.collection(collection).listDocuments();
    documentsRead[collection] = refs.length;
    refs.forEach((ref) => uids.add(ref.id));
  }
  const missing = await accounts.missing([...uids]);
  return {
    documentsRead,
    orphans: [...uids].filter((uid) => missing.has(uid)),
  };
}

/**
 * Deletes what orphaned accounts left, as the Auth deletion trigger does
 * (`kontoGeloescht`: tombstones first, then both documents), so a rerun ends
 * the same. Without `deleteOrphans` it only counts (dry run).
 */
export async function cleanUpOrphanedAccounts(
  db: Firestore,
  accounts: ExistingAccounts,
  { deleteOrphans }: { readonly deleteOrphans: boolean }
): Promise<OrphanCleanupReport> {
  const { documentsRead, orphans } = await findOrphanedAccounts(db, accounts);
  if (deleteOrphans) {
    for (const uid of orphans) {
      await kontoGeloescht(db, uid);
    }
  }
  return {
    documentsRead,
    orphansFound: orphans.length,
    orphansDeleted: deleteOrphans ? orphans.length : 0,
  };
}
