/**
 * Where Korbjäger's functions run: next to the Firestore database they
 * write, whose location was fixed when it was created (`REGIONEN.firestore`
 * in `apps/korbjaeger/src/shared/regionen.ts`, kept equal by
 * `config.spec.ts`). The app's Nitro function runs elsewhere, in
 * `REGIONEN.funktion`.
 */
export const REGION = 'europe-west3';

/**
 * How long a tombstone (`DELETED_ACCOUNTS_COLLECTION` of
 * `@wolsok/feat-korbjaeger-collections`) stays: longer than any ID token of the deleted
 * account lives (an hour), as none can be refreshed once the account is
 * gone. Firestore's TTL deletes it after its `expireAt`.
 */
export const GRABSTEIN_DAUER_MS = 24 * 60 * 60 * 1000;
