import { later, sdkError } from './fake-callbacks';

/** A user as the account reads one. */
export interface FakeUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  providerData: {
    providerId: string;
    displayName: string | null;
    photoURL?: string | null;
  }[];
}

/** What a user's ID token says, as `getIdTokenResult` reads it. */
export interface FakeToken {
  claims: Record<string, unknown>;
  signInProvider: string | null;
}

/** A guest: an anonymous account. */
export function guestUser(uid: string): FakeUser {
  return {
    uid,
    isAnonymous: true,
    displayName: null,
    email: null,
    providerData: [],
  };
}

/** A Google account whose name only the Google profile has. */
export function googleUser(uid: string, name: string): FakeUser {
  return {
    uid,
    isAnonymous: false,
    displayName: null,
    email: null,
    providerData: [{ providerId: 'google.com', displayName: name }],
  };
}

/** The token a user holds unless a spec gives them another: plain Google. */
export const PLAIN_GOOGLE_TOKEN: FakeToken = Object.freeze({
  claims: { email_verified: true },
  signInProvider: 'google.com',
});

type UserListener = (user: FakeUser | null) => void;

/**
 * Firebase Auth as the game's account uses it, in memory: the user set by
 * hand ({@link become}) or by the SDK's sign-ins, the auth state and token
 * listeners told soon after they subscribe, guests `guest-1`, `guest-2`, …
 * The popups and the credential sign-in are jest mocks a spec answers;
 * `signInWithCredential` signs in as a Google user named after the
 * credential by default. It is also the `auth` instance the connection
 * carries, so the adapter reads `currentUser` from it.
 */
export class FakeFirebaseAuth {
  public currentUser: FakeUser | null = null;
  /** The token each user holds, by uid - {@link PLAIN_GOOGLE_TOKEN} by default. */
  public readonly tokens = new Map<string, FakeToken>();
  /** The error code guest sign-ins fail with, null while they work. */
  public refusesGuests: string | null = null;

  public readonly getIdTokenResult = jest.fn(
    async (user: FakeUser, _forceRefresh?: boolean): Promise<FakeToken> =>
      this.tokens.get(user.uid) ?? PLAIN_GOOGLE_TOKEN
  );
  public readonly linkWithPopup = jest.fn();
  public readonly signInWithPopup = jest.fn();
  public readonly signInWithCredential = jest.fn(
    async (_auth: unknown, credential: string) => {
      this.become(googleUser(credential, 'Ada'));
      return { user: this.currentUser };
    }
  );

  private readonly stateListeners = new Set<UserListener>();
  private readonly tokenListeners = new Set<UserListener>();
  private guests = 0;

  /** The SDK's Auth calls. */
  public readonly sdk = {
    onAuthStateChanged: (_auth: unknown, listener: UserListener) =>
      this.subscribe(this.stateListeners, listener),
    onIdTokenChanged: (_auth: unknown, listener: UserListener) =>
      this.subscribe(this.tokenListeners, listener),
    getIdTokenResult: (user: FakeUser, forceRefresh?: boolean) =>
      this.getIdTokenResult(user, forceRefresh),
    signInAnonymously: async () => {
      if (this.refusesGuests !== null) {
        throw sdkError(this.refusesGuests);
      }
      this.become(guestUser(`guest-${++this.guests}`));
      return { user: this.currentUser };
    },
    signOut: async () => this.become(null),
    linkWithPopup: (...args: unknown[]) => this.linkWithPopup(...args),
    signInWithPopup: (...args: unknown[]) => this.signInWithPopup(...args),
    signInWithCredential: (auth: unknown, credential: string) =>
      this.signInWithCredential(auth, credential),
    browserPopupRedirectResolver: {},
    GoogleAuthProvider: Object.assign(class {}, {
      credentialFromError: (error: { credential?: string }) =>
        error.credential ?? null,
    }),
  };

  /** Another user signs in, or nobody: both listeners are told at once. */
  public become(user: FakeUser | null): void {
    this.currentUser = user;
    this.stateListeners.forEach((listener) => listener(user));
    this.tokenListeners.forEach((listener) => listener(user));
  }

  /** A new token for the same user - a refresh, or a claim granted. */
  public newToken(): void {
    this.tokenListeners.forEach((listener) => listener(this.currentUser));
  }

  private subscribe(
    listeners: Set<UserListener>,
    listener: UserListener
  ): () => void {
    listeners.add(listener);
    later(() => {
      if (listeners.has(listener)) {
        listener(this.currentUser);
      }
    });
    return () => listeners.delete(listener);
  }
}
