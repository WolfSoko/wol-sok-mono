/**
 * Korbjäger's Firestore collections (ADR 0019). The legacy names are those
 * before #2966, read only by the migration and deleted with an account,
 * until the follow-up of #2966 removes them.
 */

/** Each signed-in Elternteil's `AuswahlDokument`, by uid. */
export const SELECTIONS_COLLECTION = 'selections';

/**
 * A deleted account's tombstone, by uid: written by the Auth deletion's
 * trigger, closed to clients, deleted by Firestore's TTL on `expireAt`.
 */
export const DELETED_ACCOUNTS_COLLECTION = 'deletedAccounts';

/** The selections of version 1 and 2, with German fields. */
export const LEGACY_SELECTIONS_COLLECTION = 'auswahl';

/** The tombstones the deletion wrote before #2966. */
export const LEGACY_DELETED_ACCOUNTS_COLLECTION = 'geloeschteKonten';
