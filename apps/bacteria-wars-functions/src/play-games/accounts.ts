import type { Auth } from 'firebase-admin/auth';
import type { PlayGamesAccounts } from './sign-in';

/** {@link PlayGamesAccounts} on Firebase Auth. */
export function authAccounts(auth: Auth): PlayGamesAccounts {
  return {
    async account(uid) {
      try {
        const user = await auth.getUser(uid);
        return {
          hasProvider: user.providerData.length > 0,
          displayName: user.displayName ?? null,
          claims: user.customClaims ?? {},
        };
      } catch (error) {
        if ((error as { code?: unknown }).code === 'auth/user-not-found') {
          return null;
        }
        throw error;
      }
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
