import { Timestamp } from 'firebase-admin/firestore';
import {
  fakeAccounts,
  google,
  guest,
  linkedPlayer,
} from '../testing/fake-play-games-accounts';
import { useEmulatorDb } from '../testing/emulator';
import { adoptPlayGamesAccount } from './adoption';
import { runPlayGamesAdoption } from './adoption-command';
import { signInPlayGames } from './sign-in';

/**
 * A Google account adopting a Play-only account (#3187) against the
 * Firestore emulator (`test-emulator`): the links move only with a fresh
 * release of the same tab, the Play-only account's progress landed, and no
 * ban on either side.
 */
const db = useEmulatorDb();

const NOW = Date.UTC(2026, 10, 22, 12);
const NONCE = '0123456789abcdef0123456789abcdef';
const OTHER_NONCE = 'fedcba9876543210fedcba9876543210';
const ADOPTION = { from: 'a', nonce: NONCE };

/** A's release, `minutesAgo` before NOW. */
const release = (minutesAgo = 1, nonce = NONCE) =>
  db.doc('playGamesReleases/a').set({
    uid: 'a',
    nonce,
    createdAt: Timestamp.fromMillis(NOW - minutesAgo * 60_000),
    expireAt: Timestamp.fromMillis(NOW + 86_400_000),
  });

/** A's progress, and B's document of it listing the adoption ids. */
async function progress(applied: string[] = [NONCE]): Promise<void> {
  await db.doc('players/a/storage/bacteria-game.progress').set({ json: '{}' });
  await db
    .doc('players/b/storage/bacteria-game.progress')
    .set({ json: '{}', applied });
}

const linkOf = async (playerId: string) =>
  (await db.doc(`playGamesLinks/${playerId}`).get()).get('uid') ?? null;

const accountsOf = () => fakeAccounts({ a: linkedPlayer(), b: google() });

beforeEach(async () => {
  await db.doc('playGamesLinks/p1').set({ uid: 'a' });
});

describe('adoptPlayGamesAccount', () => {
  it('moves the link and the claim to the adopting account and consumes the release', async () => {
    await release();
    await progress();
    const fake = accountsOf();

    expect(
      await adoptPlayGamesAccount(db, 'b', ADOPTION, {
        accounts: fake.accounts,
        now: NOW,
      })
    ).toEqual({ ok: true });

    expect(await linkOf('p1')).toBe('b');
    expect((await db.doc('playGamesReleases/a').get()).exists).toBe(false);
    expect(fake.updates).toEqual([
      ['b', { admin: true, playGames: true }, undefined],
      ['a', {}, undefined],
    ]);
  });

  it('moves every link of the account, none of another', async () => {
    await db.doc('playGamesLinks/p2').set({ uid: 'a' });
    await db.doc('playGamesLinks/p3').set({ uid: 'c' });
    await release();
    await progress();

    await adoptPlayGamesAccount(db, 'b', ADOPTION, {
      accounts: accountsOf().accounts,
      now: NOW,
    });

    expect([
      await linkOf('p1'),
      await linkOf('p2'),
      await linkOf('p3'),
    ]).toEqual(['b', 'b', 'c']);
  });

  it('takes an account without storage documents, with nothing to adopt', async () => {
    await release();

    expect(
      await adoptPlayGamesAccount(db, 'b', ADOPTION, {
        accounts: accountsOf().accounts,
        now: NOW,
      })
    ).toEqual({ ok: true });
    expect(await linkOf('p1')).toBe('b');
  });

  it.each([
    ['no release', async () => undefined],
    ['a stale release', () => release(11)],
    ['a release of another tab (the race)', () => release(1, OTHER_NONCE)],
  ])('moves nothing with %s', async (_, setUp) => {
    await setUp();
    await progress();
    const fake = accountsOf();

    expect(
      await adoptPlayGamesAccount(db, 'b', ADOPTION, {
        accounts: fake.accounts,
        now: NOW,
      })
    ).toEqual({ ok: false, error: 'no-release' });
    expect(await linkOf('p1')).toBe('a');
    expect(fake.updates).toEqual([]);
  });

  it('moves nothing while a storage document of the account has not landed', async () => {
    await release();
    await progress(['an-older-adoption']);
    const fake = accountsOf();

    expect(
      await adoptPlayGamesAccount(db, 'b', ADOPTION, {
        accounts: fake.accounts,
        now: NOW,
      })
    ).toEqual({ ok: false, error: 'not-adopted' });
    expect(await linkOf('p1')).toBe('a');
    expect((await db.doc('playGamesReleases/a').get()).exists).toBe(true);
    expect(fake.updates).toEqual([]);
  });

  it.each(['a', 'b'])('moves nothing while %s is banned', async (banned) => {
    await release();
    await progress();
    await db.doc(`bans/${banned}`).set({ until: null });
    const fake = accountsOf();

    expect(
      await adoptPlayGamesAccount(db, 'b', ADOPTION, {
        accounts: fake.accounts,
        now: NOW,
      })
    ).toEqual({ ok: false, error: 'banned' });
    expect(await linkOf('p1')).toBe('a');
    expect(fake.updates).toEqual([]);
  });

  it('takes no writer without Google, and none that is gone', async () => {
    await release();
    await progress();
    const fake = fakeAccounts({ a: linkedPlayer(), b: guest() });

    expect(
      await adoptPlayGamesAccount(db, 'b', ADOPTION, {
        accounts: fake.accounts,
        now: NOW,
      })
    ).toEqual({ ok: false, error: 'not-google' });
    expect(
      await adoptPlayGamesAccount(db, 'gone', ADOPTION, {
        accounts: fake.accounts,
        now: NOW,
      })
    ).toEqual({ ok: false, error: 'no-account' });
    expect(await linkOf('p1')).toBe('a');
  });

  it('lets the adopting account keep the link at its next Play Games sign-in, and a guest be taken over by it', async () => {
    await release();
    await progress();
    const fake = fakeAccounts({ a: linkedPlayer(), b: google(), g: guest() });
    await adoptPlayGamesAccount(db, 'b', ADOPTION, {
      accounts: fake.accounts,
      now: NOW,
    });
    const deps = {
      player: async () => ({ playerId: 'p1', displayName: 'PlayAda' }),
      tombstone: async () => false,
      accounts: fake.accounts,
      now: NOW,
    };

    expect(await signInPlayGames(db, 'b', 'code', deps)).toEqual({
      result: { ok: true },
      token: null,
    });
    expect(await signInPlayGames(db, 'g', 'code', deps)).toEqual({
      result: { ok: true },
      token: { value: 'token-for-b', uid: 'b' },
    });
  });
});

describe('runPlayGamesAdoption', () => {
  const command = (extra: object = {}) => ({
    uid: 'b',
    from: 'a',
    nonce: NONCE,
    createdAt: Timestamp.fromMillis(NOW),
    expireAt: Timestamp.fromMillis(NOW + 86_400_000),
    ...extra,
  });
  const run = async (data: Record<string, unknown>, authId = 'b') => {
    await db.doc('playGamesAdoptions/c1').set(data);
    return runPlayGamesAdoption(db, 'c1', data, authId, {
      accounts: async () => accountsOf().accounts,
      now: () => NOW,
    });
  };

  it('runs once and writes the result back', async () => {
    await release();
    await progress();

    expect(await run(command())).toEqual({ ok: true });
    expect((await db.doc('playGamesAdoptions/c1').get()).get('result.ok')).toBe(
      true
    );
    // A second delivery of the same create finds it claimed.
    expect(
      await runPlayGamesAdoption(db, 'c1', command(), 'b', {
        accounts: async () => accountsOf().accounts,
        now: () => NOW,
      })
    ).toBeNull();
  });

  it('refuses another writer, itself as from, or a malformed command', async () => {
    await release();
    await progress();

    expect(await run(command(), 'eve')).toEqual({
      ok: false,
      error: 'not-writer',
    });
    expect(await run(command({ from: 'b' }))).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(await run(command({ nonce: 'x' }))).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(await linkOf('p1')).toBe('a');
  });
});
