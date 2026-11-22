import { useEmulatorDb } from '../testing/emulator';
import { type PlayGamesCommandDeps, runPlayGamesSignIn } from './command';
import { logger } from 'firebase-functions/logger';
import { syncPlayGamesAchievements } from './achievements';
import { playGamesPlayer, type PlayGamesPlayer } from './player';
import { type PlayGamesAccounts, signInPlayGames } from './sign-in';
import {
  fakeAccounts,
  google,
  guest,
  linkedPlayer,
} from '../testing/fake-play-games-accounts';
import { fakeGamesApi } from '../testing/fake-play-games-api';

/**
 * The Play Games sign-in against the Firestore emulator (`test-emulator`):
 * the link transaction, the marks and the token, with Auth and Google's
 * exchange faked. Each outcome of `settleLink`, a relink of a gone
 * account, and what the sign-in must never do.
 */
const db = useEmulatorDb();

const NOW = Date.UTC(2026, 10, 22, 12);
const GAMES = fakeGamesApi().games;
const PLAYER: PlayGamesPlayer = {
  playerId: 'p1',
  displayName: 'PlayAda',
  games: GAMES,
};

const link = async () =>
  (await db.doc('playGamesLinks/p1').get()).data() ?? null;

function deps(
  accounts: PlayGamesAccounts,
  player: PlayGamesPlayer | null = PLAYER
) {
  return {
    player: async () => player,
    tombstone: async () => false,
    accounts,
    now: NOW,
  };
}

describe('signInPlayGames', () => {
  it('links a new player to a guest and answers its token', async () => {
    const fake = fakeAccounts({ g: guest() });
    expect(await signInPlayGames(db, 'g', 'code', deps(fake.accounts))).toEqual(
      {
        result: { ok: true },
        token: { value: 'token-for-g', uid: 'g' },
        sync: { uid: 'g', games: GAMES },
      }
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
      { result: { ok: true }, token: null, sync: { uid: 'a', games: GAMES } }
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
      {
        result: { ok: true },
        token: { value: 'token-for-a', uid: 'a' },
        // The linked account's achievements, not the guest's.
        sync: { uid: 'a', games: GAMES },
      }
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
      {
        result: { ok: false, error: 'linked-elsewhere' },
        token: null,
        sync: null,
      }
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
      sync: null,
    });
    expect(await link()).toBeNull();
    expect(fake.tokens).toEqual([]);
  });

  it('bans the writer and links nothing while the player’s ban tombstone holds', async () => {
    const fake = fakeAccounts({ g: guest() });
    const tombstone = jest.fn(async () => true);
    expect(
      await signInPlayGames(db, 'g', 'code', {
        ...deps(fake.accounts),
        tombstone,
      })
    ).toEqual({
      result: { ok: false, error: 'banned' },
      token: null,
      sync: null,
    });
    expect(tombstone).toHaveBeenCalledWith('p1', 'g');
    expect(await link()).toBeNull();
    expect(fake.updates).toEqual([]);
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
      fake: ReturnType<typeof fakeAccounts>,
      more: Partial<PlayGamesCommandDeps> = {}
    ) =>
      runPlayGamesSignIn(db, 'c1', data, authId, {
        player: async () => PLAYER,
        tombstone: async () => false,
        accounts: async () => fake.accounts,
        syncAchievements: async () => undefined,
        now: () => NOW,
        ...more,
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

    it('syncs the settled account’s achievements once the result is written', async () => {
      const data = { uid: 'g', code: 'code' };
      await db.doc(PATH).set(data);
      await db.doc('playGamesLinks/p1').set({ uid: 'a', linkedAt: 1 });
      const synced: [string, unknown, unknown][] = [];
      const syncAchievements = async (uid: string, games: unknown) => {
        synced.push([uid, games, (await db.doc(PATH).get()).get('result')]);
      };

      await run(data, 'g', fakeAccounts({ g: guest(), a: google() }), {
        syncAchievements,
      });
      expect(synced).toEqual([
        ['a', GAMES, expect.objectContaining({ ok: true })],
      ]);
    });

    it.each([
      [
        'linked-elsewhere',
        { a: google(), other: google() },
        {},
        async () =>
          db.doc('playGamesLinks/p1').set({ uid: 'other', linkedAt: 1 }),
      ],
      [
        'play-games-refused',
        { a: google() },
        { player: async () => null },
        null,
      ],
      ['banned', { a: google() }, { tombstone: async () => true }, null],
    ] as const)(
      'syncs nothing on %s',
      async (error, accounts, more, before) => {
        const data = { uid: 'a', code: 'code' };
        await db.doc(PATH).set(data);
        await before?.();
        const syncAchievements = jest.fn(async () => undefined);

        expect(
          await run(data, 'a', fakeAccounts({ ...accounts }), {
            ...more,
            syncAchievements,
          })
        ).toEqual({ ok: false, error });
        expect(syncAchievements).not.toHaveBeenCalled();
      }
    );

    it('syncs nothing for a command written in another uid’s name', async () => {
      const data = { uid: 'a', code: 'code' };
      await db.doc(PATH).set(data);
      const syncAchievements = jest.fn(async () => undefined);
      await run(data, 'eve', fakeAccounts({ a: google() }), {
        syncAchievements,
      });
      expect(syncAchievements).not.toHaveBeenCalled();
    });

    it('keeps the result and the token when the sync fails', async () => {
      const data = { uid: 'g', code: 'code' };
      await db.doc(PATH).set(data);
      jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

      expect(
        await run(data, 'g', fakeAccounts({ g: guest() }), {
          syncAchievements: async () => {
            throw new TypeError('fetch failed');
          },
        })
      ).toEqual({ ok: true });
      expect((await db.doc(PATH).get()).data()).toMatchObject({
        result: { ok: true },
        token: 'token-for-g',
      });
      expect(logger.warn).toHaveBeenCalledWith(
        'Play Games achievement sync failed',
        { error: 'TypeError' }
      );
      jest.restoreAllMocks();
    });

    it('stores and logs the access token nowhere', async () => {
      const ACCESS = 'ya29.secret-access-token';
      const REFRESH = '1//secret-refresh-token';
      const data = { uid: 'g', code: 'code' };
      await db.doc(PATH).set(data);
      await db.doc('players/g/storage/bacteria-game.progress').set({
        json: JSON.stringify({ achievements: { 'first-blood': '2026-11-20' } }),
      });
      const lines: unknown[] = [];
      for (const level of ['debug', 'info', 'log', 'warn', 'error'] as const) {
        jest
          .spyOn(logger, level)
          .mockImplementation((...args: unknown[]) => void lines.push(args));
      }
      // Google answers everything, the unlock with a refusal that names the
      // token, as an error body might.
      const fetchFn = (async (url: string) => {
        const body = url.endsWith('/token')
          ? { access_token: ACCESS, refresh_token: REFRESH }
          : url.endsWith('/players/me')
            ? { playerId: 'p1', displayName: 'PlayAda' }
            : url.includes('/players/me/achievements')
              ? { items: [] }
              : url.includes('/achievements?')
                ? { items: [{ id: 'P1', name: 'First Blood' }] }
                : { error: `bad token ${ACCESS}` };
        return new Response(JSON.stringify(body), {
          status: url.endsWith('/unlock') ? 401 : 200,
        });
      }) as typeof fetch;

      await run(data, 'g', fakeAccounts({ g: guest() }), {
        player: (code) =>
          playGamesPlayer(code, { id: 'web', secret: 'shh' }, fetchFn),
        syncAchievements: (uid, games) =>
          syncPlayGamesAchievements(db, uid, games, NOW),
      });

      const written = JSON.stringify(
        (await db.collection('playGamesSignIns').get()).docs.map((doc) =>
          doc.data()
        )
      );
      const logged = JSON.stringify(lines);
      expect(written).toContain('token-for-g');
      expect(logged).toContain('First Blood');
      for (const secret of [ACCESS, REFRESH]) {
        expect(written).not.toContain(secret);
        expect(logged).not.toContain(secret);
      }
      jest.restoreAllMocks();
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
