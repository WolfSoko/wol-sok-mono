import { type Auth } from 'firebase-admin/auth';
import { type ExistingAccounts } from './orphaned-accounts';

/** The most identifiers Auth's `getUsers` takes in one call. */
export const GET_USERS_LIMIT = 100;

/**
 * `ExistingAccounts` on the admin SDK's Auth: looks the uids up in batches
 * of `GET_USERS_LIMIT`. A failed lookup rejects, so nothing is deleted on a
 * guess.
 */
export function authAccounts(auth: Auth): ExistingAccounts {
  return {
    async missing(uids) {
      const missing = new Set<string>();
      for (let start = 0; start < uids.length; start += GET_USERS_LIMIT) {
        const batch = uids.slice(start, start + GET_USERS_LIMIT);
        const { notFound } = await auth.getUsers(batch.map((uid) => ({ uid })));
        notFound.forEach((identifier) => {
          if ('uid' in identifier) {
            missing.add(identifier.uid);
          }
        });
      }
      return missing;
    },
  };
}
