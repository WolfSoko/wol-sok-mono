import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { runAdminCommand } from '../admin/command';
import { erasePlayer } from '../admin/erase';
import { clearBanCache } from '../limits';
import { fakeRealtime } from '../testing/fake-realtime';
import { deletePlayerSocial } from './delete-player';
import { backfillMirrors, mirrorListing } from './mirror';

/**
 * The friend lists' mirrors and the erasing of a deleted account's social
 * and personal data against the Firestore emulator (`test-emulator`), ADR
 * 0012, owner's decisions of 2026-10-26. The Realtime Database is a fake
 * tree (`testing/fake-realtime.ts`).
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 26, 12);
const since = Timestamp.fromMillis(NOW - HOUR);

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

const exists = async (path: string) => (await db.doc(path).get()).exists;

describe('the friend lists mirror', () => {
  it('follows an entry as it stands, however its events arrive', async () => {
    const realtime = fakeRealtime();
    await db.doc('players/ada/friends/bob').set({ since });
    expect(await mirrorListing(db, realtime, 'friends', 'ada', 'bob')).toBe(
      true
    );
    // Twice: the same.
    await mirrorListing(db, realtime, 'friends', 'ada', 'bob');
    expect(realtime.tree).toEqual({
      statusReaders: { ada: { bob: true } },
      listedBy: { bob: { ada: { friends: true } } },
    });
    await db.doc('players/bob/requests/ada').set({ at: since });
    await mirrorListing(db, realtime, 'requests', 'bob', 'ada');
    expect(realtime.tree['listedBy']).toEqual({
      bob: { ada: { friends: true } },
      ada: { bob: { requests: true } },
    });
    await db.doc('players/ada/friends/bob').delete();
    await mirrorListing(db, realtime, 'friends', 'ada', 'bob');
    expect(realtime.tree).toEqual({
      listedBy: { ada: { bob: { requests: true } } },
    });
  });

  it('is backfilled from every list, idempotently', async () => {
    const realtime = fakeRealtime();
    await db.doc('players/ada/friends/bob').set({ since });
    await db.doc('players/bob/friends/ada').set({ since });
    await db.doc('players/cy/requests/ada').set({ at: since });
    // Not a player's list.
    await db.doc('other/x/friends/y').set({ since });
    const counts = await backfillMirrors(db, realtime);
    expect(counts).toEqual({
      friends: 2,
      requests: 1,
      removed: 0,
      skipped: 0,
    });
    expect(await backfillMirrors(db, realtime)).toEqual(counts);
    expect(realtime.tree).toEqual({
      statusReaders: { ada: { bob: true }, bob: { ada: true } },
      listedBy: {
        bob: { ada: { friends: true } },
        ada: { bob: { friends: true }, cy: { requests: true } },
      },
    });
  });

  it('ends on the entry as it is when it changes during the write', async () => {
    await db.doc('players/ada/friends/bob').set({ since });
    const base = fakeRealtime();
    let writes = 0;
    // The create's handler writes late: the delete's ran in between.
    const realtime = {
      ...base,
      update: async (values: Readonly<Record<string, true | null>>) => {
        await base.update(values);
        if (++writes === 1) {
          await db.doc('players/ada/friends/bob').delete();
        }
      },
    };
    expect(await mirrorListing(db, realtime, 'friends', 'ada', 'bob')).toBe(
      false
    );
    expect(base.tree).toEqual({});
  });

  it('skips an id the Realtime Database takes as no key', async () => {
    const realtime = fakeRealtime();
    await db.doc('players/ada/friends/b.b').set({ since });
    expect(await mirrorListing(db, realtime, 'friends', 'ada', 'b.b')).toBe(
      false
    );
    expect(realtime.tree).toEqual({});
  });

  it('removes in a backfill what no list entry stands behind', async () => {
    const realtime = fakeRealtime({
      statusReaders: { ada: { bob: true, zed: true } },
      listedBy: {
        bob: { ada: { friends: true } },
        zed: { ada: { friends: true, requests: true } },
        cy: { ada: { invites: true } },
      },
    });
    await db.doc('players/ada/friends/bob').set({ since });
    await db.doc('players/ada/friends/b$b').set({ since });
    expect(await backfillMirrors(db, realtime)).toEqual({
      friends: 1,
      requests: 0,
      removed: 4,
      skipped: 1,
    });
    expect(realtime.tree).toEqual({
      statusReaders: { ada: { bob: true } },
      listedBy: { bob: { ada: { friends: true } } },
    });
  });

  it('keeps in a backfill an entry whose list entry came meanwhile', async () => {
    const base = fakeRealtime({ statusReaders: { ada: { bob: true } } });
    // Bob is listed after the backfill read the lists, before it removes.
    let reads = 0;
    const realtime = {
      ...base,
      update: async (values: Readonly<Record<string, true | null>>) => {
        if (++reads === 2) {
          await db.doc('players/ada/friends/bob').set({ since });
        }
        await base.update(values);
      },
    };
    await backfillMirrors(db, realtime);
    expect(base.tree['statusReaders']).toEqual({ ada: { bob: true } });
  });

  it('is backfilled by the owner, audited', async () => {
    const realtime = fakeRealtime();
    await db.doc('players/ada/friends/bob').set({ since });
    const data = {
      uid: 'own',
      type: 'presence.backfill',
      target: null,
      args: {},
    };
    await db.doc('adminCommands/c1').set(data);
    const result = await runAdminCommand(
      db,
      'c1',
      data,
      'own',
      {
        isOwner: async (uid) => uid === 'own',
        realtime,
        tombstoneOf: async () => null,
        accountUids: async () => [],
        toggles: { update: async () => ({}) as never },
      },
      NOW
    );
    expect(result).toEqual({ ok: true });
    expect(realtime.tree['statusReaders']).toEqual({ ada: { bob: true } });
    expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
      type: 'presence.backfill',
      after: { friends: 1, requests: 0 },
      ok: true,
    });
  });
});

describe('deletePlayerSocial', () => {
  /** Ada, her friends and what others hold of her. */
  async function seedAda() {
    await Promise.all([
      db.doc('profiles/ada').set({ name: 'Ada' }),
      db.doc('players/ada/storage/bacteria-game.progress').set({ json: '{}' }),
      db.doc('players/ada/notices/n1').set({ type: 'banned' }),
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
    expect(await deletePlayerSocial(db, realtime, 'ada')).toEqual({
      others: 4,
      // Profile, queue, 4 x 3 entries, an invite and two open rooms.
      deleted: 17,
    });
    for (const path of [
      'profiles/ada',
      'players/ada/storage/bacteria-game.progress',
      'players/ada/notices/n1',
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
    expect(await deletePlayerSocial(db, realtime, 'ada')).toMatchObject({
      others: 1,
    });
    expect(await exists('players/ada/friends/b.b')).toBe(false);
    expect(await exists('players/b.b/friends/ada')).toBe(false);
    expect(realtime.tree).toEqual({});
  });

  it('changes nothing the second time', async () => {
    await seedAda();
    const realtime = realtimeOfAda();
    await deletePlayerSocial(db, realtime, 'ada');
    expect(await deletePlayerSocial(db, realtime, 'ada')).toEqual({
      others: 0,
      deleted: 2,
    });
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
    await erasePlayer(db, realtime, 'ada', null, NOW);
    expect(await exists('profiles/ada')).toBe(false);
    expect(await exists('boardMembers/ada')).toBe(false);
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(1);
    expect((await db.doc('replays/mine').get()).get('players')).toEqual([]);
    expect(realtime.tree).toEqual({});
  });

  it('lowers the account count once, however often an erase runs', async () => {
    await Promise.all([
      db.doc('boardMembers/ada').set({ accountCounted: true }),
      db.doc('stats/accounts').set({ total: 2 }),
    ]);
    // The sweep's erase and a trigger at the same time, then a retry.
    await Promise.all([
      erasePlayer(db, fakeRealtime(), 'ada', null, NOW),
      erasePlayer(db, fakeRealtime(), 'ada', null, NOW),
    ]);
    await erasePlayer(db, fakeRealtime(), 'ada', null, NOW);
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(1);
  });

  it('leaves the count to a caller that sums the decrements', async () => {
    await Promise.all([
      db.doc('boardMembers/ada').set({ accountCounted: true }),
      db.doc('stats/accounts').set({ total: 2 }),
    ]);
    let uncounted = 0;
    await erasePlayer(db, fakeRealtime(), 'ada', null, NOW, {
      uncounted: () => uncounted++,
    });
    expect(uncounted).toBe(1);
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(2);
  });
});
