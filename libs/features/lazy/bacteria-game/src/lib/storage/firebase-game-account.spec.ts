import { firstValueFrom } from 'rxjs';
import type { FirebaseConnection } from './firebase-connection';
import { FirebaseGameAccount } from './firebase-game-account';
import type { PlayerSwitch } from './game-account';

interface FakeUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  providerData: { providerId: string; displayName: string | null }[];
}

const guest = (uid: string): FakeUser => ({
  uid,
  isAnonymous: true,
  displayName: null,
  email: null,
  providerData: [],
});

const google = (uid: string, name: string): FakeUser => ({
  uid,
  isAnonymous: false,
  displayName: null,
  email: null,
  providerData: [{ providerId: 'google.com', displayName: name }],
});

/** What a user's ID token says, as `getIdTokenResult` reads it. */
interface FakeToken {
  claims: Record<string, unknown>;
  signInProvider: string | null;
}

/** The token of the owner: the claim, a verified email, a Google sign-in. */
const OWNER_TOKEN: FakeToken = {
  claims: { admin: true, email_verified: true },
  signInProvider: 'google.com',
};

/** Just enough of Firebase Auth: one listener each, users set by hand. */
class FakeAuth {
  public currentUser: FakeUser | null = null;
  private listener: (user: FakeUser | null) => void = () => undefined;
  private tokenListener: (user: FakeUser | null) => void = () => undefined;
  /** The token each user holds, by uid - a plain Google one by default. */
  public tokens = new Map<string, FakeToken>();
  public getIdTokenResult = jest.fn(
    async (user: FakeUser, forceRefresh?: boolean): Promise<FakeToken> => {
      void forceRefresh;
      return (
        this.tokens.get(user.uid) ?? {
          claims: { email_verified: true },
          signInProvider: 'google.com',
        }
      );
    }
  );
  private guests = 0;
  /** The error code guest sign-ins fail with, null while they work. */
  public refusesGuests: string | null = null;
  public linkWithPopup = jest.fn();
  public signInWithCredential = jest.fn(async (_auth, credential: string) => {
    this.become(google(credential, 'Ada'));
    return { user: this.currentUser };
  });

  public readonly sdk = {
    onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => {
      this.listener = listener;
      queueMicrotask(() => listener(this.currentUser));
      return () => undefined;
    },
    onIdTokenChanged: (_auth: unknown, listener: (user: unknown) => void) => {
      this.tokenListener = listener;
      queueMicrotask(() => listener(this.currentUser));
      return () => undefined;
    },
    getIdTokenResult: (user: FakeUser, forceRefresh?: boolean) =>
      this.getIdTokenResult(user, forceRefresh),
    signInAnonymously: async () => {
      if (this.refusesGuests !== null) {
        throw { code: this.refusesGuests };
      }
      this.become(guest(`guest-${++this.guests}`));
      return { user: this.currentUser };
    },
    signOut: async () => this.become(null),
    linkWithPopup: (...args: unknown[]) => this.linkWithPopup(...args),
    signInWithPopup: jest.fn(),
    signInWithCredential: (...args: [unknown, string]) =>
      this.signInWithCredential(...args),
    GoogleAuthProvider: Object.assign(class {}, {
      credentialFromError: (error: { credential?: string }) =>
        error.credential ?? null,
    }),
  };

  public become(user: FakeUser | null): void {
    this.currentUser = user;
    this.listener(user);
    this.tokenListener(user);
  }

  /** A new token for the same user - a refresh, or a claim granted. */
  public newToken(): void {
    this.tokenListener(this.currentUser);
  }

  public connection(): FirebaseConnection {
    return {
      auth: this,
      authSdk: this.sdk,
    } as unknown as FirebaseConnection;
  }
}

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe('FirebaseGameAccount', () => {
  let auth: FakeAuth;
  let account: FirebaseGameAccount;
  let switches: PlayerSwitch[];

  beforeEach(async () => {
    auth = new FakeAuth();
    account = new FirebaseGameAccount(auth.connection());
    switches = [];
    account.players.subscribe((player) => switches.push(player));
    await settle();
  });

  it('plays as a guest without asking', () => {
    expect(switches).toEqual([{ playerId: 'guest-1', adoptsGuest: false }]);
    expect(account.profile()).toEqual({ guest: true, name: null });
  });

  it('knows the next player already when a switch is told', async () => {
    const seen: string[] = [];
    account.players.subscribe(() =>
      firstValueFrom(account.playerIds).then((id) => seen.push(id))
    );

    auth.become(guest('guest-9'));
    await settle();

    expect(seen).toEqual(['guest-1', 'guest-9']);
  });

  it('keeps the player when a guest signs in to a new Google account', async () => {
    auth.linkWithPopup.mockResolvedValue({ user: google('guest-1', 'Ada') });

    expect(await account.signIn()).toBe('signed-in');

    expect(switches).toHaveLength(1);
    expect(account.profile()).toEqual({ guest: false, name: 'Ada' });
  });

  it('lets a Google account that played elsewhere take over and adopt the guest', async () => {
    auth.linkWithPopup.mockRejectedValue({
      code: 'auth/credential-already-in-use',
      credential: 'ada',
    });

    expect(await account.signIn()).toBe('signed-in');

    expect(switches.at(-1)).toEqual({ playerId: 'ada', adoptsGuest: true });
  });

  it('starts a new guest, adopting nothing, after signing out', async () => {
    auth.linkWithPopup.mockRejectedValue({
      code: 'auth/credential-already-in-use',
      credential: 'ada',
    });
    await account.signIn();

    await account.signOut();
    await settle();

    expect(switches.at(-1)).toEqual({
      playerId: 'guest-2',
      adoptsGuest: false,
    });
    expect(account.profile()).toEqual({ guest: true, name: null });
  });

  it('has nobody play between a sign-out and the next guest', async () => {
    jest.useFakeTimers();
    auth.refusesGuests = 'auth/network-request-failed';
    const ids: (string | null)[] = [];
    account.playerIds.subscribe((id) => ids.push(id));

    await account.signOut();
    await jest.advanceTimersByTimeAsync(0);

    expect(switches.at(-1)).toEqual({ playerId: null, adoptsGuest: false });
    expect(account.profile()).toBeNull();
    auth.refusesGuests = null;
    await jest.advanceTimersByTimeAsync(1000);
    expect(ids).toEqual(['guest-1', null, 'guest-2']);
    jest.useRealTimers();
  });

  it('stops asking for a guest the project refuses', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.refusesGuests = 'auth/operation-not-allowed';
    const tries = jest.spyOn(auth.sdk, 'signInAnonymously');

    await account.signOut();
    await jest.advanceTimersByTimeAsync(120_000);

    expect(tries).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('tells a closed popup from a failed sign-in', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    auth.linkWithPopup.mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
    });
    auth.linkWithPopup.mockRejectedValueOnce({ code: 'auth/network-error' });

    expect(await account.signIn()).toBe('cancelled');
    expect(await account.signIn()).toBe('failed');
    expect(switches).toHaveLength(1);
  });

  describe('owner', () => {
    it('is nobody as a guest, without reading the token', () => {
      expect(account.owner()).toBe(false);
      expect(auth.getIdTokenResult).not.toHaveBeenCalled();
    });

    it('is the Google account with the admin claim and a verified email, read from the token it holds', async () => {
      auth.tokens.set('ada', OWNER_TOKEN);

      auth.become(google('ada', 'Ada'));
      await settle();

      expect(account.owner()).toBe(true);
      // No forced refresh: the admin area checks with a fresh one.
      expect(auth.getIdTokenResult).toHaveBeenLastCalledWith(
        expect.objectContaining({ uid: 'ada' }),
        undefined
      );
    });

    it.each<[string, FakeToken]>([
      ['no admin claim', { ...OWNER_TOKEN, claims: { email_verified: true } }],
      [
        'an admin claim that is not true',
        { ...OWNER_TOKEN, claims: { admin: 'yes', email_verified: true } },
      ],
      [
        'an unverified email',
        { ...OWNER_TOKEN, claims: { admin: true, email_verified: false } },
      ],
      [
        'a sign-in other than Google',
        { ...OWNER_TOKEN, signInProvider: 'password' },
      ],
    ])('is nobody with %s', async (_case, token) => {
      auth.tokens.set('ada', token);

      auth.become(google('ada', 'Ada'));
      await settle();

      expect(account.owner()).toBe(false);
    });

    it('follows the token: a claim granted shows with the next one, and goes with a sign-out', async () => {
      auth.become(google('ada', 'Ada'));
      await settle();
      expect(account.owner()).toBe(false);

      auth.tokens.set('ada', OWNER_TOKEN);
      auth.newToken();
      await settle();
      expect(account.owner()).toBe(true);

      await account.signOut();
      await settle();
      expect(account.owner()).toBe(false);
    });

    it('is nobody when the token cannot be read', async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      auth.getIdTokenResult.mockRejectedValueOnce(new Error('offline'));

      auth.become(google('ada', 'Ada'));
      await settle();

      expect(account.owner()).toBe(false);
    });
  });
});
