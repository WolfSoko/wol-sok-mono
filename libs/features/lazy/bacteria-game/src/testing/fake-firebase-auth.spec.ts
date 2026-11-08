import { settleSnapshots } from './fake-callbacks';
import {
  FakeFirebaseAuth,
  googleUser,
  guestUser,
  PLAIN_GOOGLE_TOKEN,
} from './fake-firebase-auth';

describe('FakeFirebaseAuth', () => {
  let auth: FakeFirebaseAuth;

  beforeEach(() => {
    auth = new FakeFirebaseAuth();
  });

  function follow(
    listen: FakeFirebaseAuth['sdk']['onAuthStateChanged']
  ): (string | null)[] {
    const seen: (string | null)[] = [];
    listen(auth, (user) => seen.push(user?.uid ?? null));
    return seen;
  }

  it('tells the auth state and token listeners soon after they subscribe, and on each switch', async () => {
    const states = follow(auth.sdk.onAuthStateChanged);
    const tokens = follow(auth.sdk.onIdTokenChanged);
    expect(states).toEqual([]);
    await settleSnapshots();

    auth.become(googleUser('ada', 'Ada'));
    auth.newToken();

    expect(states).toEqual([null, 'ada']);
    expect(tokens).toEqual([null, 'ada', 'ada']);
  });

  it('tells a listener nothing once it stopped', async () => {
    const seen: unknown[] = [];
    const stop = auth.sdk.onAuthStateChanged(auth, (user) => seen.push(user));
    stop();
    await settleSnapshots();

    auth.become(guestUser('g'));

    expect(seen).toEqual([]);
  });

  it('signs in numbered guests, and signs out', async () => {
    await auth.sdk.signInAnonymously();
    expect(auth.currentUser).toEqual(guestUser('guest-1'));

    await auth.sdk.signOut();
    expect(auth.currentUser).toBeNull();

    await auth.sdk.signInAnonymously();
    expect(auth.currentUser?.uid).toBe('guest-2');
  });

  it('fails a guest sign-in with the code a project refuses it with', async () => {
    auth.refusesGuests = 'auth/operation-not-allowed';

    await expect(auth.sdk.signInAnonymously()).rejects.toMatchObject({
      code: 'auth/operation-not-allowed',
    });
    expect(auth.currentUser).toBeNull();
  });

  it("reads a user's token, a plain Google one by default", async () => {
    const owner = { claims: { admin: true }, signInProvider: 'google.com' };
    auth.tokens.set('ada', owner);

    expect(await auth.sdk.getIdTokenResult(googleUser('ada', 'Ada'))).toBe(
      owner
    );
    expect(await auth.sdk.getIdTokenResult(googleUser('bob', 'Bob'))).toBe(
      PLAIN_GOOGLE_TOKEN
    );
  });

  it('signs in with a credential as the Google account it names', async () => {
    await auth.sdk.signInWithCredential(auth, 'ada');

    expect(auth.currentUser).toEqual(googleUser('ada', 'ada'));
  });

  it('reads the credential of an error, null without one', () => {
    const { credentialFromError } = auth.sdk.GoogleAuthProvider;

    expect(credentialFromError({ credential: 'ada' })).toBe('ada');
    expect(credentialFromError({})).toBeNull();
  });
});
