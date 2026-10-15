export type Account = {
  uid: string;
  /** Signed in only by the automatic anonymous sign-in, not with Google. */
  isAnonymous: boolean;
  displayName: string | null;
  photoUrl: string | null;
};

/** Signed in with Google, not just the automatic anonymous sign-in. */
export function isGoogleAccount(account: Account | null): account is Account {
  return account !== null && !account.isAnonymous;
}
