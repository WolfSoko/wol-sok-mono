import type { Auth } from 'firebase-admin/auth';
import { userRecordOf } from '../auth-users';
import type { PlayGamesAccounts } from './sign-in';

/** {@link PlayGamesAccounts} on Firebase Auth. */
export function authAccounts(auth: Auth): PlayGamesAccounts {
  return {
    async account(uid) {
      const user = await userRecordOf(auth, uid);
      return user === null
        ? null
        : {
            hasProvider: user.providerData.length > 0,
            displayName: user.displayName ?? null,
            claims: user.customClaims ?? {},
          };
    },
    async update(uid, claims, displayName) {
      // Claims replace each other whole: `claims` carries the old ones.
      await auth.setCustomUserClaims(uid, claims);
      if (displayName !== undefined) {
        await auth.updateUser(uid, { displayName });
      }
    },
    customToken: (uid) => auth.createCustomToken(uid),
  };
}
