export type Account = {
  uid: string;
  /** Signed in only by the automatic anonymous sign-in, not with Google. */
  isAnonymous: boolean;
  displayName: string | null;
  photoUrl: string | null;
};
