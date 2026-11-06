import { Timestamp } from 'firebase-admin/firestore';
import { runAdminCommand } from '../admin/command';
import { useEmulatorDb } from '../testing/emulator';
import { fakeRealtime } from '../testing/fake-realtime';
import { backfillMirrors, mirrorListing } from './mirror';

/**
 * The friend lists' mirrors against the Firestore emulator
 * (`test-emulator`), ADR 0012, owner's decisions of 2026-10-26; the
 * erasing of a deleted account is `erasure/erasure.emulator.ts`'s. The
 * Realtime Database is a fake tree (`testing/fake-realtime.ts`).
 */
const db = useEmulatorDb();

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 26, 12);
const since = Timestamp.fromMillis(NOW - HOUR);

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
