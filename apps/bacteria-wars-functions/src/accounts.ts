import type { Auth, UserRecord } from 'firebase-admin/auth';

/** What the functions need to know of a player's Auth account. */
export interface Account {
  uid: string;
  /** True for a guest: no provider linked. */
  anonymous: boolean;
  /** When the account was created, ms since the epoch. */
  createdAt: number;
  /** True with the claim `admin`, a verified email and a Google provider. */
  admin: boolean;
  /**
   * The uid of the linked Google identity, which a ban tombstone is keyed
   * by (ADR 0012) - null or absent without one.
   */
  googleUid?: string | null;
}

/** Looks up accounts by uid; unknown ones are missing from the map. */
export type AccountLookup = (
  uids: readonly string[]
) => Promise<Map<string, Account>>;

/** The account as the functions read it. */
export function accountOf(user: UserRecord): Account {
  const providers = user.providerData.map((info) => info.providerId);
  const google = user.providerData.find(
    (info) => info.providerId === 'google.com'
  );
  return {
    uid: user.uid,
    anonymous: providers.length === 0,
    createdAt: Date.parse(user.metadata.creationTime),
    admin:
      user.customClaims?.['admin'] === true &&
      user.emailVerified &&
      google !== undefined,
    googleUid: google?.uid ?? null,
  };
}

/** Accounts from Firebase Auth, a hundred at a time. */
export function authAccounts(auth: Auth): AccountLookup {
  return async (uids) => {
    const accounts = new Map<string, Account>();
    const unique = [...new Set(uids)];
    for (let i = 0; i < unique.length; i += 100) {
      const { users } = await auth.getUsers(
        unique.slice(i, i + 100).map((uid) => ({ uid }))
      );
      for (const user of users) {
        accounts.set(user.uid, accountOf(user));
      }
    }
    return accounts;
  };
}

/**
 * True when the user is the owner right now: the claim `admin`, a verified
 * email and a Google provider, read again from Auth - a revoked claim stops
 * working at once, not after the token's hour (ADR 0011, ADR 0012).
 */
export async function isAdminNow(
  lookup: AccountLookup,
  uid: string
): Promise<boolean> {
  return (await lookup([uid])).get(uid)?.admin === true;
}
