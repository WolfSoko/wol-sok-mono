import { firstValueFrom } from 'rxjs';
import {
  type FakeFirebaseAuth,
  type FakeToken,
  playGamesToken,
  fakeToken,
  googleUser,
  guestUser,
  playGamesUser,
} from '../../testing/fake-firebase-auth';
import {
  FakeFirebase,
  settleSnapshots as settle,
} from '../../testing/fake-firebase-sdk';
import { FirebaseGameAccount } from './firebase-game-account';
import type { PlayerSwitch } from './game-account';

/** The token of the owner: the claim, a verified email, a Google sign-in. */
const OWNER_TOKEN = fakeToken({ admin: true, email_verified: true });

describe('FirebaseGameAccount', () => {
  let auth: FakeFirebaseAuth;
  let firebase: FakeFirebase;
  let account: FirebaseGameAccount;
  let switches: PlayerSwitch[];

  beforeEach(async () => {
    const fake = new FakeFirebase();
    firebase = fake;
    auth = fake.auth;
    account = new FirebaseGameAccount(fake.connection());
    switches = [];
    account.players.subscribe((player) => switches.push(player));
    await settle();
  });

  it('plays as a guest without asking', () => {
    expect(switches).toEqual([{ playerId: 'guest-1', adoptsGuest: false }]);
    expect(account.profile()).toEqual({ guest: true, name: null });
  });

  it('knows the next player already when a switch is told', async () => {
    const seen: (string | null)[] = [];
    account.players.subscribe(() =>
      firstValueFrom(account.playerIds).then((id) => seen.push(id))
    );

    auth.become(guestUser('guest-9'));
    await settle();

    expect(seen).toEqual(['guest-1', 'guest-9']);
  });

  it('keeps the player when a guest signs in to a new Google account', async () => {
    auth.linkWithPopup.mockResolvedValue({
      user: googleUser('guest-1', 'Ada'),
    });

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

  describe('the Play Games sign-in', () => {
    it('makes the guest a signed-in player, without a switch', async () => {
      expect(
        await account.signInWithToken(playGamesToken('guest-1'), 'guest-1')
      ).toBe(true);
      await settle();

      expect(switches).toEqual([{ playerId: 'guest-1', adoptsGuest: false }]);
      expect(account.profile()).toEqual({
        guest: false,
        name: 'Player guest-1',
      });
    });

    it('lets the account of the player take over and adopt the guest', async () => {
      expect(
        await account.signInWithToken(playGamesToken('ada'), 'guest-1')
      ).toBe(true);

      expect(switches.at(-1)).toEqual({ playerId: 'ada', adoptsGuest: true });
    });

    it('adopts nothing at a later switch after a same-account token', async () => {
      await account.signInWithToken(playGamesToken('guest-1'), 'guest-1');
      await account.signOut();
      await settle();

      expect(switches.at(-1)).toEqual({
        playerId: 'guest-2',
        adoptsGuest: false,
      });
    });

    it('refuses a token Auth refuses', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      auth.signInWithCustomToken.mockRejectedValueOnce({
        code: 'auth/invalid-custom-token',
      });
      expect(
        await account.signInWithToken(playGamesToken('ada'), 'guest-1')
      ).toBe(false);
      expect(switches).toHaveLength(1);
    });

    it('drops a token that arrives after the player changed', async () => {
      auth.become(googleUser('g', 'Ada'));
      await settle();

      expect(
        await account.signInWithToken(playGamesToken('ada'), 'guest-1')
      ).toBe(false);
      expect(auth.signInWithCustomToken).not.toHaveBeenCalled();
      expect(switches.at(-1)).toEqual({ playerId: 'g', adoptsGuest: false });
    });

    it('keeps the session of a player signed in to the same account', async () => {
      auth.become(googleUser('guest-1', 'Ada'));

      expect(
        await account.signInWithToken(playGamesToken('guest-1'), 'guest-1')
      ).toBe(false);
      expect(auth.signInWithCustomToken).not.toHaveBeenCalled();
    });

    it('links Google to the account of a Play Games player', async () => {
      auth.become(playGamesUser('guest-1', 'PlayAda'));
      auth.linkWithPopup.mockResolvedValue({
        user: googleUser('guest-1', 'Ada'),
      });

      expect(await account.signIn()).toBe('signed-in');

      expect(auth.linkWithPopup).toHaveBeenCalled();
      expect(auth.signInWithPopup).not.toHaveBeenCalled();
    });
  });

  describe('a Play-only account adopted by a Google account that played elsewhere (#3187)', () => {
    /** The documents of a collection, by path. */
    const docsOf = (collection: string) =>
      [...firebase.docs].filter(([path]) => path.startsWith(`${collection}/`));

    beforeEach(() => {
      auth.become(playGamesUser('a', 'PlayAda'));
      auth.linkWithPopup.mockRejectedValue({
        code: 'auth/credential-already-in-use',
        credential: 'b',
      });
    });

    /** A player document that lands its adoption as `stored` says. */
    const document = (stored: Promise<boolean>) =>
      account.players.subscribe(({ adoption }) => adoption?.landed(stored));

    it('releases the account, then hands its link over once every document landed', async () => {
      document(Promise.resolve(true));
      document(Promise.resolve(true));

      expect(await account.signIn()).toBe('signed-in');
      await settle();

      const [[, release]] = docsOf('playGamesReleases');
      const nonce = release['nonce'];
      expect(nonce).toMatch(/^[0-9a-f]{32}$/);
      expect(release['uid']).toBe('a');
      expect(switches.at(-1)).toMatchObject({
        playerId: 'b',
        adoptsGuest: true,
        adoption: { id: nonce },
      });
      expect(docsOf('playGamesAdoptions').map(([, data]) => data)).toEqual([
        expect.objectContaining({ uid: 'b', from: 'a', nonce }),
      ]);
    });

    it('hands nothing over while a document did not land', async () => {
      document(Promise.resolve(true));
      document(Promise.resolve(false));

      await account.signIn();
      await settle();

      expect(docsOf('playGamesReleases')).toHaveLength(1);
      expect(docsOf('playGamesAdoptions')).toEqual([]);
    });

    it('switches without an adoption when the release is refused', async () => {
      firebase.refused.add('playGamesReleases/a');

      expect(await account.signIn()).toBe('signed-in');
      await settle();

      expect(switches.at(-1)).toEqual({ playerId: 'b', adoptsGuest: true });
      expect(docsOf('playGamesAdoptions')).toEqual([]);
    });

    it('releases nothing for a guest', async () => {
      auth.become(guestUser('guest-2'));
      await settle();

      await account.signIn();
      await settle();

      expect(switches.at(-1)).toEqual({ playerId: 'b', adoptsGuest: true });
      expect(docsOf('playGamesReleases')).toEqual([]);
    });
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

      auth.become(googleUser('ada', 'Ada'));
      await settle();

      expect(account.owner()).toBe(true);
      // No forced refresh: the admin area checks with a fresh one.
      const [user, forceRefresh] = auth.getIdTokenResult.mock.lastCall ?? [];
      expect(user).toMatchObject({ uid: 'ada' });
      expect(forceRefresh).toBeUndefined();
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

      auth.become(googleUser('ada', 'Ada'));
      await settle();

      expect(account.owner()).toBe(false);
    });

    it('follows the token: a claim granted shows with the next one, and goes with a sign-out', async () => {
      auth.become(googleUser('ada', 'Ada'));
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

      auth.become(googleUser('ada', 'Ada'));
      await settle();

      expect(account.owner()).toBe(false);
    });
  });
});
