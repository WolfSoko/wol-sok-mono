const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where the Firestore database with the accounts' choices lies: fixed when
 * it was created (ADR 0019). Korbjäger's Cloud Functions run next to it; the
 * privacy policy names it.
 */
export const FIRESTORE_REGION = {
  id: 'europe-west3',
  place: 'Frankfurt am Main',
} as const;

/** One region of Google's: its id and the place the privacy policy names. */
export type Region = { readonly id: string; readonly place: string };

/**
 * The collection of the Elternteile's choices (Meine Teams, Kinder,
 * Vereinsfarben), one document per uid. Persisted: renamed only with a
 * migration (#2966).
 */
export const CHOICES_COLLECTION = 'auswahl';

/**
 * The tombstones of deleted accounts, one per uid: while one exists the
 * rules refuse every request on that uid's choices (`istBesitzer` in
 * `apps/korbjaeger/firestore.rules`). Persisted, like `CHOICES_COLLECTION`.
 */
export const DELETED_ACCOUNTS_COLLECTION = 'geloeschteKonten';

/**
 * How many days a tombstone stays: longer than any ID token of the deleted
 * account lives (an hour), as none can be refreshed once the account is
 * gone.
 */
export const TOMBSTONE_DAYS = 1;

/** `TOMBSTONE_DAYS` in milliseconds, for the tombstone's `expireAt`. */
export const TOMBSTONE_DURATION_MS = TOMBSTONE_DAYS * DAY_MS;

/**
 * How many days Cloud Functions retries a failed 1st-gen background
 * function with `failurePolicy` before it gives up: Google's limit, not a
 * setting of ours.
 */
export const DELETION_RETRY_DAYS = 7;

/**
 * How many days after its `expireAt` Firestore's TTL deletes a tombstone at
 * the latest: Google's figure ("typically within 24 hours"), not a setting
 * of ours.
 */
export const TTL_DELETION_DAYS = 1;
