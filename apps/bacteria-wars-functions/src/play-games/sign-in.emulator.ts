import { useEmulatorDb } from '../testing/emulator';
import { runPlayGamesSignIn } from './command';
import type { PlayGamesPlayer } from './player';
import {
  type PlayGamesAccount,
  type PlayGamesAccounts,
  signInPlayGames,
} from './sign-in';

/**
 * The Play Games sign-in against the Firestore emulator (`test-emulator`):
 * the link transaction, the marks and the token, with Auth and Google's
 * exchange faked. Each outcome of `settleLink`, a relink of a gone
 * account, and what the sign-in must never do.
 */
const db = useEmulatorDb();

const NOW = Date.UTC(2026, 10, 22, 12);
const PLAYER: PlayGamesPlayer = { playerId: 'p1', displayName: 'PlayAda' };

const guest = (): PlayGamesAccount => ({
  hasProvider: false,
  displayName: null,
  claims: {},
});
const google = (): PlayGamesAccount => ({
  hasProvider: true,
  displayName: 'Ada',
  claims: { admin: true },
});
const linkedPlayer = (): PlayGamesAccount => ({
  hasProvider: false,
  displayName: 'PlayAda',
  claims: { playGames: true },
});

/** Auth with the given accounts; logs what was written and minted. */
function fakeAccounts(known: Record<string, PlayGamesAccount>) {
  const updates: [string, Record<string, unknown>, string | undefined][] = [];
  const tokens: string[] = [];
  const accounts: PlayGamesAccounts = {
    account: async (uid) => known[uid] ?? null,
    update: async (uid, claims, displayName) => {
      updates.push([uid, claims, displayName]);
      const account = known[uid];
      if (account !== undefined) {
        known[uid] = {
          ...account,
          claims,
          displayName: displayName ?? account.displayName,
        };
      }
    },
    customToken: async (uid) => {
      tokens.push(uid);
      return `token-for-${uid}`;
    },
  };
  return { accounts, updates, tokens };
}

const link = async () =>
  (await db.doc('playGamesLinks/p1').get()).data() ?? null;

function deps(
  accounts: PlayGamesAccounts,
  player: PlayGamesPlayer | null = PLAYER
) {
  return { player: async () => player, accounts, now: NOW };
}

describe('signInPlayGames', () => {
  it('links a new player to a guest and answers its token', async () => {
    const fake = fakeAccounts({ g: guest() });
    expect(await signInPlayGames(db, 'g', 'code', deps(fake.accounts))).toEqual(
      { result: { ok: true }, token: { value: 'token-for-g', uid: 'g' } }
    );
    expect((await link())?.['uid']).toBe('g');
    expect((await link())?.['linkedAt'].toMillis()).toBe(NOW);
    // A guest has no name: it gets the Play Games one.
    expect(fake.updates).toEqual([['g', { playGames: true }, 'PlayAda']]);
  });

  it('keeps a link to a Google writer, with its claims, name and own session', async () => {
    await db.doc('playGamesLinks/p1').set({ uid: 'a', linkedAt: 1 });
    const fake = fakeAccounts({ a: google() });
    // No token: a custom-token session would lose the Google provider the
    // owner's rights hang on.
    expect(await signInPlayGames(db, 'a', 'code', deps(fake.accounts))).toEqual(
      { result: { ok: true }, token: null }
    );
    expect(await link()).toEqual({ uid: 'a', linkedAt: 1 });
    expect(fake.updates).toEqual([
      ['a', { admin: true, playGames: true }, undefined],
    ]);
    expect(fake.tokens).toEqual([]);
  });

  it('writes nothing to Auth at a later start of a linked player', async () => {
    await db.doc('playGamesLinks/p1').set({ uid: 'g', linkedAt: 1 });
    const fake = fakeAccounts({ g: linkedPlayer() });
    expect(
      (await signInPlayGames(db, 'g', 'code', deps(fake.accounts))).token
    ).toEqual({ value: 'token-for-g', uid: 'g' });
    expect(fake.updates).toEqual([]);
  });

  it('hands a guest the account the player is linked to', async () => {
    await db.doc('playGamesLinks/p1').set({ uid: 'a', linkedAt: 1 });
    const fake = fakeAccounts({ g: guest(), a: google() });
    expect(await signInPlayGames(db, 'g', 'code', deps(fake.accounts))).toEqual(
      { result: { ok: true }, token: { value: 'token-for-a', uid: 'a' } }
    );
    expect(await link()).toEqual({ uid: 'a', linkedAt: 1 });
    // Only the settled account is marked, and only it gets a token.
    expect(fake.updates.map(([uid]) => uid)).toEqual(['a']);
    expect(fake.tokens).toEqual(['a']);
  });

  it.each([
    ['another Google account', google],
    ['an account without provider', linkedPlayer],
  ])('refuses a Google writer while %s holds the player', async (_, other) => {
    await db.doc('playGamesLinks/p1').set({ uid: 'other', linkedAt: 1 });
    const fake = fakeAccounts({ a: google(), other: other() });
    expect(await signInPlayGames(db, 'a', 'code', deps(fake.accounts))).toEqual(
      { result: { ok: false, error: 'linked-elsewhere' }, token: null }
    );
    expect(await link()).toEqual({ uid: 'other', linkedAt: 1 });
    expect(fake.updates).toEqual([]);
    expect(fake.tokens).toEqual([]);
  });

  it('relinks a player whose account is gone', async () => {
    await db.doc('playGamesLinks/p1').set({ uid: 'deleted', linkedAt: 1 });
    const fake = fakeAccounts({ g: guest() });
    expect(
      (await signInPlayGames(db, 'g', 'code', deps(fake.accounts))).token
    ).toEqual({ value: 'token-for-g', uid: 'g' });
    expect((await link())?.['uid']).toBe('g');
  });

  it('answers play-games-refused for a code Google refuses, and links nothing', async () => {
    const fake = fakeAccounts({ g: guest() });
    expect(
      await signInPlayGames(db, 'g', 'used', deps(fake.accounts, null))
    ).toEqual({
      result: { ok: false, error: 'play-games-refused' },
      token: null,
    });
    expect(await link()).toBeNull();
    expect(fake.tokens).toEqual([]);
  });

  it('leaves a ban where it is', async () => {
    await db.doc('bans/g').set({ reason: 'cheating', until: null });
    await db.doc('playGamesLinks/p1').set({ uid: 'a', linkedAt: 1 });
    const fake = fakeAccounts({ g: guest(), a: guest() });
    await signInPlayGames(db, 'g', 'code', deps(fake.accounts));
    expect((await db.doc('bans/g').get()).data()).toEqual({
      reason: 'cheating',
      until: null,
    });
    expect((await db.doc('bans/a').get()).exists).toBe(false);
  });

  describe('as a command', () => {
    const PATH = 'playGamesSignIns/c1';
    const run = (
      data: Record<string, unknown>,
      authId: string | undefined,
      fake: ReturnType<typeof fakeAccounts>
    ) =>
      runPlayGamesSignIn(db, 'c1', data, authId, {
        player: async () => PLAYER,
        accounts: async () => fake.accounts,
        now: () => NOW,
      });

    it('writes the token and its uid beside the result', async () => {
      const data = { uid: 'g', code: 'code' };
      await db.doc(PATH).set(data);
      const fake = fakeAccounts({ g: guest() });

      expect(await run(data, 'g', fake)).toEqual({ ok: true });
      expect((await db.doc(PATH).get()).data()).toMatchObject({
        result: { ok: true },
        token: 'token-for-g',
        tokenUid: 'g',
        claimedAt: expect.anything(),
      });
    });

    it('runs a second delivery of the same command not at all', async () => {
      const data = { uid: 'g', code: 'code' };
      await db.doc(PATH).set(data);
      const fake = fakeAccounts({ g: guest() });
      await run(data, 'g', fake);

      expect(await run(data, 'g', fake)).toBeNull();
      expect(fake.tokens).toEqual(['g']);
    });

    it('answers malformed for a command without a code', async () => {
      const data = { uid: 'g' };
      await db.doc(PATH).set(data);
      expect(await run(data, 'g', fakeAccounts({ g: guest() }))).toEqual({
        ok: false,
        error: 'malformed',
      });
    });

    it('settles nothing for a command written in another uid’s name', async () => {
      const data = { uid: 'a', code: 'code' };
      await db.doc(PATH).set(data);
      const fake = fakeAccounts({ a: google(), eve: guest() });

      expect(await run(data, 'eve', fake)).toEqual({
        ok: false,
        error: 'not-writer',
      });
      expect(await link()).toBeNull();
      expect(fake.tokens).toEqual([]);
    });
  });
});
