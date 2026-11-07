import { Timestamp } from 'firebase-admin/firestore';
import { runReplayCommand } from '../replays/command';
import { useEmulatorDb } from '../testing/emulator';
import { erasureAt } from '../testing/erasure';
import { fakeRealtime } from '../testing/fake-realtime';
import { erasePart, erasePlayer } from './erase';
import { ERASURE_PARTS, type Plain, plainEntriesOf } from './player-data';

/**
 * A deleted account's erasure against the Firestore emulator
 * (`test-emulator`), ADR 0012, owner's decisions of 2026-10-26: every entry
 * of the player data map (`PLAYER_DATA`) that goes by its path or a field,
 * then what each part's own code erases or keeps. The Realtime Database is
 * a fake tree (`testing/fake-realtime.ts`).
 */
const db = useEmulatorDb();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 3, 12);

const exists = async (path: string) => (await db.doc(path).get()).exists;

/** Where `entry` keeps `uid`'s data: the paths to seed and look at. */
function placesOf(entry: Plain, uid: string): string[] {
  const at = entry.path.replace('{uid}', uid);
  switch (entry.erase) {
    case 'doc':
    case 'node':
      return [at];
    case 'tree':
      return [at, `${at}/below/doc`];
    case 'field':
      return [`${entry.path.split('/')[0]}/${uid}-1`];
  }
}

describe('the plain entries of the player data map', () => {
  const entries = ERASURE_PARTS.flatMap((part) => plainEntriesOf(part));

  it.each(entries.map((entry) => [entry.part, entry.path, entry] as const))(
    '%s erases %s, and nobody else’s',
    async (part, _, entry) => {
      const realtime = fakeRealtime();
      for (const uid of ['ada', 'bob']) {
        for (const path of placesOf(entry, uid)) {
          if (entry.erase === 'node') {
            await realtime.update({ [`${path}/state`]: true });
          } else {
            await db
              .doc(path)
              .set(entry.erase === 'field' ? { [entry.field]: uid } : {});
          }
        }
      }
      await erasePart(part, erasureAt(db, NOW, realtime), 'ada');
      const present = async (path: string) =>
        entry.erase === 'node'
          ? (await realtime.get(path)) !== null
          : exists(path);
      for (const path of placesOf(entry, 'ada')) {
        expect([path, await present(path)]).toEqual([path, false]);
      }
      for (const path of placesOf(entry, 'bob')) {
        expect([path, await present(path)]).toEqual([path, true]);
      }
    }
  );
});

describe('the account part', () => {
  it("erases the board entries and daily runs, and nobody else's", async () => {
    const day = '2026-10-25';
    await db.doc('boardMembers/ada').set({
      entryIds: { xp: 'x1', online: 'o1', endless: 'e1', daily: 'd1' },
      boards: ['xp', 'online', 'endless', `daily-${day}`],
    });
    const mine = [
      'boards/xp/entries/x1',
      'boards/online/entries/o1',
      'boards/endless/entries/e1',
      `boards/daily-${day}/entries/d1`,
      `dailyRuns/${day}_ada`,
    ];
    for (const path of mine) {
      await db.doc(path).set({ uid: 'ada' });
    }
    const theirs = ['boards/xp/entries/x2', `dailyRuns/${day}_bob`];
    for (const path of theirs) {
      await db.doc(path).set({ uid: 'bob' });
    }
    // Five of its own, and boardMembers, limits and moderation.
    expect(await erasePart('account', erasureAt(db, NOW), 'ada')).toEqual({
      deleted: 8,
    });
    for (const path of [...mine, 'boardMembers/ada']) {
      expect([path, await exists(path)]).toEqual([path, false]);
    }
    for (const path of theirs) {
      expect([path, await exists(path)]).toEqual([path, true]);
    }
  });

  it('copes with an account that never reached a board', async () => {
    expect(await erasePart('account', erasureAt(db, NOW), 'ada')).toEqual({
      deleted: 3,
    });
  });

  it("scrubs the audit entries about the player and keeps the others'", async () => {
    await db.doc('adminAudit/c1').set({
      target: { uid: 'ada' },
      type: 'player.ban',
      before: { name: 'Ada' },
      after: null,
    });
    await db.doc('adminAudit/c2').set({
      target: { uid: 'bob' },
      before: { name: 'Bob' },
    });
    await erasePart('account', erasureAt(db, NOW), 'ada');
    expect((await db.doc('adminAudit/c1').get()).data()).toEqual({
      target: { uid: 'ada' },
      type: 'player.ban',
      before: { scrubbed: true },
      after: { scrubbed: true },
    });
    expect((await db.doc('adminAudit/c2').get()).get('before')).toEqual({
      name: 'Bob',
    });
  });

  describe('of a banned account', () => {
    const until = NOW + 30 * DAY;
    async function seedBan(end: number | null, noted: string[] = []) {
      await db.doc('bans/ada').set({
        since: Timestamp.fromMillis(NOW - DAY),
        until: end === null ? null : Timestamp.fromMillis(end),
        reason: 'cheating',
      });
      await db.doc('moderation/ada').set({ tombstones: noted });
    }
    const tombstone = (id: string) => db.doc(`banTombstones/${id}`).get();

    it('keeps the ban as tombstones, by the Google provider and those noted, and erases the ban', async () => {
      await seedBan(until, ['t-old']);
      const realtime = fakeRealtime({ bans: { ada: until } });
      await erasePart(
        'account',
        { ...erasureAt(db, NOW, realtime), tombstone: 't-ada' },
        'ada'
      );
      for (const id of ['t-ada', 't-old']) {
        expect((await tombstone(id)).data()).toMatchObject({
          until: Timestamp.fromMillis(until),
          reason: 'cheating',
        });
      }
      expect(await exists('bans/ada')).toBe(false);
      expect(await exists('moderation/ada')).toBe(false);
      expect(realtime.tree).toEqual({});
    });

    it('keeps it by the ids the ban noted, once Google is unlinked', async () => {
      await seedBan(null, ['t-old']);
      await erasePart('account', erasureAt(db, NOW), 'ada');
      expect((await tombstone('t-old')).get('reason')).toBe('cheating');
      expect(await exists('bans/ada')).toBe(false);
    });

    it('writes no tombstone for a ban that ended', async () => {
      await seedBan(NOW - HOUR);
      await erasePart(
        'account',
        { ...erasureAt(db, NOW), tombstone: 't-ada' },
        'ada'
      );
      expect((await tombstone('t-ada')).exists).toBe(false);
      expect(await exists('bans/ada')).toBe(false);
    });
  });

  describe('and the account count', () => {
    beforeEach(() => db.doc('stats/accounts').set({ total: 2 }));
    const total = async () =>
      (await db.doc('stats/accounts').get()).get('total');

    it('lowers it only for an account countAccount counted', async () => {
      await db.doc('boardMembers/ada').set({ entryIds: {} });
      await erasePart('account', erasureAt(db, NOW), 'ada');
      expect(await total()).toBe(2);
    });

    it('lowers it once, however often an erase runs', async () => {
      await db.doc('boardMembers/ada').set({ accountCounted: true });
      // The sweep's erase and a trigger at the same time, then a retry.
      await Promise.all([
        erasePlayer(erasureAt(db, NOW), 'ada'),
        erasePart('account', erasureAt(db, NOW), 'ada'),
      ]);
      await erasePlayer(erasureAt(db, NOW), 'ada');
      expect(await total()).toBe(1);
    });

    it('leaves it to a caller that sums the decrements', async () => {
      await db.doc('boardMembers/ada').set({ accountCounted: true });
      let uncounted = 0;
      await erasePlayer(
        { ...erasureAt(db, NOW), uncounted: () => uncounted++ },
        'ada'
      );
      expect(uncounted).toBe(1);
      expect(await total()).toBe(2);
    });
  });
});

describe('the social part', () => {
  const since = Timestamp.fromMillis(NOW - HOUR);

  /** Ada, her friends and what others hold of her. */
  async function seedAda() {
    await Promise.all([
      db.doc('profiles/ada').set({ name: 'Ada' }),
      db.doc('players/ada/storage/bacteria-game.progress').set({ json: '{}' }),
      db.doc('players/ada/notices/n1').set({ type: 'banned' }),
      db.doc('players/ada/attempts/d_2026-10-25_1').set({ ticks: 1 }),
      // Mutual friends.
      db.doc('players/ada/friends/bob').set({ since }),
      db.doc('players/bob/friends/ada').set({ since }),
      db.doc('players/bob/challenges/ada').set({ code: 'ABC234' }),
      // Ada asked Cy, who has not answered.
      db.doc('players/ada/friends/cy').set({ since }),
      db.doc('players/cy/requests/ada').set({ at: since }),
      // Dee asked Ada, who declined: only Dee still lists her.
      db.doc('players/dee/friends/ada').set({ since }),
      // Eve asks Ada now.
      db.doc('players/eve/friends/ada').set({ since }),
      db.doc('players/ada/requests/eve').set({ at: since }),
      // Bob's list of others stays.
      db.doc('players/bob/friends/eve').set({ since }),
      db.doc('queue/ada').set({ since }),
      db.doc('invites/aaaaaaaaaaaaaaaaaaaa').set({ from: 'ada' }),
      db.doc('invites/bbbbbbbbbbbbbbbbbbbb').set({ from: 'bob' }),
      db.doc('rooms/AAAAAA').set({ host: 'ada', offer: 'x' }),
      db.doc('rooms/BBBBBB').set({ host: 'bob', guest: 'ada', answer: 'y' }),
      // A taken room's stub stays: Bob's report is checked against it.
      db.doc('rooms/CCCCCC').set({ host: 'ada', guest: 'bob', taken: true }),
    ]);
  }

  /** The Realtime Database as the mirror and presence left it. */
  const realtimeOfAda = () =>
    fakeRealtime({
      status: { ada: { state: 'online' }, bob: { state: 'online' } },
      connections: { ada: { state: 'online' } },
      statusReaders: {
        ada: { bob: true, cy: true },
        bob: { ada: true, eve: true },
        dee: { ada: true },
        eve: { ada: true },
      },
      listedBy: {
        ada: {
          bob: { friends: true },
          dee: { friends: true },
          eve: { friends: true },
        },
        bob: { ada: { friends: true } },
        cy: { ada: { friends: true } },
        eve: { bob: { friends: true } },
      },
    });

  it("erases the player's data and their entries in other players' lists", async () => {
    await seedAda();
    const realtime = realtimeOfAda();
    expect(
      await erasePart('social', erasureAt(db, NOW, realtime), 'ada')
    ).toEqual({
      others: 4,
      // Profile, queue, 4 x 3 entries, an invite and two open rooms.
      deleted: 17,
    });
    for (const path of [
      'profiles/ada',
      'players/ada/storage/bacteria-game.progress',
      'players/ada/notices/n1',
      'players/ada/attempts/d_2026-10-25_1',
      'players/ada/friends/bob',
      'players/ada/requests/eve',
      'players/bob/friends/ada',
      'players/bob/challenges/ada',
      'players/cy/requests/ada',
      'players/dee/friends/ada',
      'players/eve/friends/ada',
      'queue/ada',
      'invites/aaaaaaaaaaaaaaaaaaaa',
      'rooms/AAAAAA',
      'rooms/BBBBBB',
    ]) {
      expect([path, await exists(path)]).toEqual([path, false]);
    }
    for (const path of [
      'players/bob/friends/eve',
      'invites/bbbbbbbbbbbbbbbbbbbb',
      'rooms/CCCCCC',
    ]) {
      expect([path, await exists(path)]).toEqual([path, true]);
    }
    expect(realtime.tree).toEqual({
      status: { bob: { state: 'online' } },
      statusReaders: { bob: { eve: true } },
      listedBy: { eve: { bob: { friends: true } } },
    });
  });

  it('skips the mirror of an id the Realtime Database takes as no key', async () => {
    await db.doc('players/ada/friends/b.b').set({ since });
    await db.doc('players/b.b/friends/ada').set({ since });
    const realtime = fakeRealtime({ status: { ada: { state: 'online' } } });
    expect(
      await erasePart('social', erasureAt(db, NOW, realtime), 'ada')
    ).toMatchObject({ others: 1 });
    expect(await exists('players/ada/friends/b.b')).toBe(false);
    expect(await exists('players/b.b/friends/ada')).toBe(false);
    expect(realtime.tree).toEqual({});
  });

  it('changes nothing the second time', async () => {
    await seedAda();
    const realtime = realtimeOfAda();
    await erasePart('social', erasureAt(db, NOW, realtime), 'ada');
    expect(
      await erasePart('social', erasureAt(db, NOW, realtime), 'ada')
    ).toEqual({ others: 0, deleted: 2 });
  });
});

describe('the replays part', () => {
  const born = Timestamp.fromMillis(NOW - DAY);
  const erase = (uid: string) => erasePart('replays', erasureAt(db, NOW), uid);

  it('keeps every replay without the player, for the statistics', async () => {
    const expireAt = Timestamp.fromMillis(NOW + 29 * DAY);
    await db
      .doc('replays/mine')
      .set({ players: ['ada'], optOut: [], createdAt: born, expireAt });
    await db.doc('replays/mine/blob/data').set({ size: 1 });
    await db.doc('replays/ours').set({
      players: ['ada', 'bob'],
      optOut: ['ada'],
      galleryOut: true,
      seats: ['ada', 'bob'],
      createdAt: born,
      expireAt,
    });
    await db.doc('replays/ours/reports/ada').set({ checksum: 1 });
    await db.doc('replays/ours/reports/bob').set({ checksum: 1 });
    expect(await erase('ada')).toEqual({
      anonymised: 2,
      public: 0,
      pending: 0,
    });
    // Nobody reads hers any more; it expires as it would have.
    expect((await db.doc('replays/mine').get()).data()).toEqual({
      players: [],
      optOut: [],
      createdAt: born,
      expireAt,
    });
    expect(await exists('replays/mine/blob/data')).toBe(true);
    // Bob still reads theirs: the room's seat forgets Ada too. Ada took it
    // out of the gallery, and it stays out without her uid.
    expect((await db.doc('replays/ours').get()).data()).toEqual({
      players: ['bob'],
      optOut: [],
      galleryOut: true,
      seats: [null, 'bob'],
      createdAt: born,
      expireAt,
    });
    expect(await exists('replays/ours/reports/ada')).toBe(false);
    expect(await exists('replays/ours/reports/bob')).toBe(true);
  });

  it('forgets both players when both accounts go at the same time', async () => {
    await db.doc('replays/ours').set({
      players: ['ada', 'bob'],
      optOut: [],
      seats: ['ada', 'bob'],
      createdAt: born,
    });
    await Promise.all([erase('ada'), erase('bob')]);
    // Kept 30 days after the match, though it had no expireAt (public).
    expect((await db.doc('replays/ours').get()).data()).toEqual({
      players: [],
      optOut: [],
      seats: [null, null],
      createdAt: born,
      expireAt: Timestamp.fromMillis(NOW + 29 * DAY),
    });
  });

  it('forgets the player in the seat of a match only the other one reported', async () => {
    await db.doc('replays/theirs').set({
      players: ['bob'],
      optOut: [],
      seats: ['bob', 'ada'],
      createdAt: born,
      expireAt: born,
    });
    expect(await erase('ada')).toEqual({
      anonymised: 1,
      public: 0,
      pending: 0,
    });
    expect((await db.doc('replays/theirs').get()).data()).toEqual({
      players: ['bob'],
      optOut: [],
      seats: ['bob', null],
      createdAt: born,
      expireAt: born,
    });
  });

  it('withdraws the pending submissions and commands, so a command run later finds nothing', async () => {
    const command = { uid: 'ada', type: 'forget', replayId: 'mine' };
    await db.doc('replays/mine').set({
      players: ['ada'],
      optOut: [],
      createdAt: born,
    });
    await db.doc('replaySubmissions/s1').set({ uid: 'ada', hint: 1 });
    await db.doc('replayCommands/c1').set(command);
    expect(await erase('ada')).toMatchObject({ anonymised: 1, pending: 2 });
    // The trigger still runs on its event's copy of the command.
    expect(
      await runReplayCommand(
        db,
        'c1',
        command,
        'ada',
        { isOwner: async () => false },
        NOW
      )
    ).toEqual({ ok: false, error: 'not-found' });
    expect(await exists('replayCommands/c1')).toBe(false);
  });
});

describe('erasePlayer', () => {
  it("erases a guest's boards, replays and social data at once", async () => {
    const realtime = fakeRealtime({ status: { ada: { state: 'online' } } });
    await Promise.all([
      db.doc('profiles/ada').set({ name: 'Ada' }),
      db.doc('boardMembers/ada').set({ accountCounted: true }),
      db.doc('stats/accounts').set({ total: 2 }),
      db.doc('replays/mine').set({
        players: ['ada'],
        optOut: [],
        createdAt: Timestamp.fromMillis(NOW - HOUR),
      }),
    ]);
    await erasePlayer(erasureAt(db, NOW, realtime), 'ada');
    expect(await exists('profiles/ada')).toBe(false);
    expect(await exists('boardMembers/ada')).toBe(false);
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(1);
    expect((await db.doc('replays/mine').get()).get('players')).toEqual([]);
    expect(realtime.tree).toEqual({});
  });
});
