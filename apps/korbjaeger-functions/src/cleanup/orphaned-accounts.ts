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

export type AccountCollection = (typeof ACCOUNT_COLLECTIONS)[number];

/** Documents listed per collection of `ACCOUNT_COLLECTIONS`. */
export type DocumentsListed = Readonly<Record<AccountCollection, number>>;

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
  readonly documentsListed: DocumentsListed;
  /** Accounts with a document but no Auth user. */
  readonly orphansFound: number;
  /** Orphans whose documents this run deleted: 0 in a dry run. */
  readonly orphansDeleted: number;
  /** Orphans whose deletion failed; a rerun takes them again. */
  readonly orphansFailed: number;
}

export interface OrphanSearch {
  readonly documentsListed: DocumentsListed;
  /** How many accounts have a document, each counted once. */
  readonly accounts: number;
  /** Each orphaned uid once, also where it has documents in both collections. */
  readonly orphans: readonly string[];
}

/**
 * Refuses a deletion where Auth knows none of the accounts with a document:
 * Firestore and Auth then most likely are not the same project (one of
 * them an emulator), and deleting would empty every living account.
 */
export class EveryAccountOrphanedError extends Error {
  public constructor(accounts: number) {
    super(
      `Auth knows none of the ${accounts} accounts with a document: ` +
        'are Firestore and Auth the same project? Nothing deleted.'
    );
    this.name = 'EveryAccountOrphanedError';
  }
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
      return [collection, refs.length] as const;
    })
  );
  const missing = await accounts.missing([...uids]);
  return {
    documentsListed: Object.fromEntries(listed) as DocumentsListed,
    accounts: uids.size,
    orphans: [...uids].filter((uid) => missing.has(uid)),
  };
}

/**
 * Deletes what orphaned accounts left, as the Auth deletion trigger does
 * (`kontoGeloescht`: tombstones first, then both documents), so a rerun ends
 * the same. Without `deleteOrphans` it only counts (dry run). A failed
 * deletion is counted, not thrown, so the report says how far it got.
 */
export async function cleanUpOrphanedAccounts(
  db: Firestore,
  accounts: ExistingAccounts,
  { deleteOrphans }: { readonly deleteOrphans: boolean }
): Promise<OrphanCleanupReport> {
  const search = await findOrphanedAccounts(db, accounts);
  const { documentsListed, orphans } = search;
  if (!deleteOrphans) {
    return {
      documentsListed,
      orphansFound: orphans.length,
      orphansDeleted: 0,
      orphansFailed: 0,
    };
  }
  if (orphans.length > 0 && orphans.length === search.accounts) {
    throw new EveryAccountOrphanedError(search.accounts);
  }
  let orphansDeleted = 0;
  for (const uid of orphans) {
    try {
      await kontoGeloescht(db, uid);
      orphansDeleted++;
    } catch {
      // counted below; the error may name the uid, so it is not printed
    }
  }
  return {
    documentsListed,
    orphansFound: orphans.length,
    orphansDeleted,
    orphansFailed: orphans.length - orphansDeleted,
  };
}
