import { defaultProfile } from '@wolsok/feat-lazy-bac-game/engine';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { rankProgress } from '../boards/rank-progress';
import { clearBanCache, isBanned } from '../limits';
import { checkGoogleLink, countAccount, deletePlayerBoards } from './accounts';
import { expireBans, tombstoneId } from './bans';
import { runAdminCommand } from './command';
import type { AccountRecord, AdminDeps } from './deps';

/**
 * The owner's commands, bans and the account functions against the
 * Firestore emulator (`test-emulator`), with Auth and the Realtime
 * Database faked.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 25, 12);
const KEY = 'test-tombstone-key';

/** Auth and the RTDB, faked: accounts by uid, the RTDB as a path map. */
function fakeDeps(accounts: Record<string, AccountRecord> = {}) {
  const rtdb = new Map<string, unknown>();
  const deps: AdminDeps = {
    account: async (uid) => accounts[uid] ?? null,
    listUids: async (token) =>
      token === undefined ? { uids: ['a', 'b'], next: 'p2' } : { uids: ['c'] },
    rtdb: {
      set: async (path, value) => void rtdb.set(path, value),
      remove: async (path) => void rtdb.delete(path),
      get: async (path) =>
        path === 'status'
          ? Object.fromEntries(
              [...rtdb]
                .filter(([key]) => key.startsWith('status/'))
                .map(([key, value]) => [key.slice(7), value])
            )
          : rtdb.get(path),
    },
    tombstoneKey: () => KEY,
  };
  return { deps, rtdb };
}

const OWNER: AccountRecord = { googleUid: 'g-own', admin: true };
const ADA_GOOGLE: AccountRecord = { googleUid: 'g-ada', admin: false };

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

/** Ada on the XP and online boards, with a profile. */
async function seedAda() {
  await db.doc('boardMembers/ada').set({
    entryIds: { xp: 'ex', online: 'eo', daily: 'ed', endless: 'ee' },
    boards: ['xp', 'online'],
  });
  for (const [board, id] of [
    ['xp', 'ex'],
    ['online', 'eo'],
  ]) {
    await db.doc(`boards/${board}/entries/${id}`).set({
      sort: 5,
      status: 'counted',
      baseStatus: 'counted',
      hiddenBy: {},
    });
  }
  await db.doc('profiles/ada').set({
    name: 'Rude Name',
    motto: 'rude motto',
    avatar: { kind: 'image', data: 'data:image/png;base64,AAAA' },
    shareStatus: false,
    publicName: true,
  });
}

/** Writes an admin command as the owner would and runs it. */
async function command(
  id: string,
  type: string,
  extra: object = {},
  deps = fakeDeps({ own: OWNER, ada: ADA_GOOGLE }).deps,
  writer = 'own'
) {
  const data = {
    uid: 'own',
    type,
    target: { uid: 'ada' },
    reason: 'test',
    args: {},
    createdAt: Timestamp.fromMillis(NOW),
    ...extra,
  };
  await db.doc(`adminCommands/${id}`).set(data);
  return runAdminCommand(db, deps, id, data, writer, NOW);
}

const status = async (board: string, id: string) =>
  (await db.doc(`boards/${board}/entries/${id}`).get()).get('status');

describe('adminCommand', () => {
  it('runs only for the owner, as the writer', async () => {
    await seedAda();
    expect(await command('c1', 'profile.reset', {}, undefined, 'ada')).toEqual({
      ok: false,
      error: 'not-writer',
    });
    const notOwner = fakeDeps({ own: { googleUid: 'g', admin: false } }).deps;
    expect(await command('c2', 'profile.reset', {}, notOwner)).toEqual({
      ok: false,
      error: 'not-admin',
    });
    expect(await command('c3', 'player.delete')).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(
      (await db.doc('adminCommands/c3').get()).get('result')
    ).toMatchObject({ ok: false, error: 'malformed' });
  });

  it('resets a profile, audits it once and tells the player', async () => {
    await seedAda();
    expect(await command('c1', 'profile.reset')).toEqual({ ok: true });
    const fresh = defaultProfile('ada');
    expect((await db.doc('profiles/ada').get()).data()).toMatchObject({
      name: fresh.name,
      motto: '',
      avatar: fresh.avatar,
      shareStatus: false,
      publicName: true,
    });
    const audit = (await db.doc('adminAudit/c1').get()).data();
    expect(audit).toMatchObject({
      by: 'own',
      type: 'profile.reset',
      target: { uid: 'ada' },
      before: { name: 'Rude Name', avatar: 'image' },
      source: 'adminCommand',
    });
    expect(audit?.['before'].image.sha256).toHaveLength(64);
    expect(JSON.stringify(audit)).not.toContain('base64');
    expect((await db.doc('players/ada/notices/c1').get()).get('type')).toBe(
      'profile-reset'
    );
    // The command id is the audit id: a repeat runs nothing.
    await command('c1', 'profile.reset');
    expect((await db.doc('moderation/ada').get()).get('resets')).toBe(1);
  });

  it('hides and bars a player on every board, and restores them', async () => {
    await seedAda();
    await command('c1', 'board.hidePlayer', { args: { bar: true } });
    expect(await status('xp', 'ex')).toBe('hidden');
    expect(await status('online', 'eo')).toBe('hidden');
    expect((await db.doc('boardMembers/ada').get()).get('barred')).toEqual([
      'xp',
      'online',
    ]);
    await command('c2', 'board.restore');
    expect(await status('xp', 'ex')).toBe('counted');
    expect((await db.doc('boardMembers/ada').get()).get('barred')).toEqual([]);
  });

  it('keeps a barred player hidden on entries made later', async () => {
    await seedAda();
    await command('c1', 'board.hidePlayer', { args: { bar: true } });
    await db.doc('boards/xp/entries/ex').delete();
    await rankProgress(
      db,
      'ada',
      { json: JSON.stringify({ totals: { matchXp: 100 } }) },
      0,
      NOW
    );
    expect(await status('xp', 'ex')).toBe('hidden');
  });

  it('refuses a hide without its board, and a ban that has ended', async () => {
    await seedAda();
    // The engine's parser wants a board entry as the target.
    expect(await command('c1', 'board.hideEntry')).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(
      await command('c2', 'player.ban', {
        args: { until: Timestamp.fromMillis(NOW - HOUR), reason: 'spam' },
      })
    ).toEqual({ ok: false, error: 'ended' });
    expect((await db.doc('players/ada/notices/c1').get()).exists).toBe(false);
  });

  it('bans again in full when the earlier ban has ended', async () => {
    await seedAda();
    await db.doc('bans/ada').set({
      since: Timestamp.fromMillis(NOW - 9 * DAY),
      until: Timestamp.fromMillis(NOW - HOUR),
      reason: 'spam',
    });
    await db.doc('queue/ada').set({ since: Timestamp.now() });
    await command('b1', 'player.ban', {
      args: { until: null, reason: 'cheating' },
    });
    expect((await db.doc('queue/ada').get()).exists).toBe(false);
    expect(await status('xp', 'ex')).toBe('hidden');
    expect(
      ((await db.doc('bans/ada').get()).get('since') as Timestamp).toMillis()
    ).toBe(NOW);
  });

  it('hides one entry found by its board', async () => {
    await seedAda();
    await command('c1', 'board.hideEntry', {
      target: { boardId: 'online', entryId: 'eo' },
    });
    expect(await status('online', 'eo')).toBe('hidden');
    expect(await status('xp', 'ex')).toBe('counted');
  });

  it('bans a player out of everything others see, and lifts it', async () => {
    await seedAda();
    const { deps, rtdb } = fakeDeps({ own: OWNER, ada: ADA_GOOGLE });
    await db.doc('queue/ada').set({ since: Timestamp.now() });
    await db.doc('rooms/ABC234').set({ host: 'ada' });
    await db.doc('invites/abcd').set({ from: 'ada' });
    await deps.rtdb.set('status/ada', { state: 'online' });
    // An entry the owner hid stays hidden after the ban is lifted.
    await command(
      'h1',
      'board.hideEntry',
      {
        target: { boardId: 'xp', entryId: 'ex' },
      },
      deps
    );

    const until = Timestamp.fromMillis(NOW + 7 * DAY);
    await command(
      'b1',
      'player.ban',
      { args: { until, reason: 'cheating' } },
      deps
    );
    expect(await isBanned(db, 'ada', NOW)).toBe(true);
    expect(rtdb.get('bans/ada')).toBe(NOW + 7 * DAY);
    expect(rtdb.has('status/ada')).toBe(false);
    for (const path of ['queue/ada', 'rooms/ABC234', 'invites/abcd']) {
      expect((await db.doc(path).get()).exists).toBe(false);
    }
    expect(await status('online', 'eo')).toBe('hidden');
    expect(
      (await db.doc(`banTombstones/${tombstoneId('g-ada', KEY)}`).get()).get(
        'reason'
      )
    ).toBe('cheating');
    expect((await db.doc('players/ada/notices/b1').get()).get('type')).toBe(
      'banned'
    );

    await command('u1', 'player.unban', {}, deps);
    clearBanCache();
    expect(await isBanned(db, 'ada', NOW)).toBe(false);
    expect(rtdb.has('bans/ada')).toBe(false);
    expect(
      (await db.doc(`banTombstones/${tombstoneId('g-ada', KEY)}`).get()).exists
    ).toBe(false);
    expect(await status('online', 'eo')).toBe('counted');
    expect(await status('xp', 'ex')).toBe('hidden');
  });

  it('refreshes the statistics and recounts the accounts', async () => {
    await seedAda();
    const { deps } = fakeDeps({ own: OWNER });
    await deps.rtdb.set('status/ada', { state: 'playing' });
    await db.doc('rooms/ABC234').set({
      taken: true,
      expireAt: Timestamp.fromMillis(NOW + HOUR),
    });
    await db.doc('rooms/DEF567').set({
      expireAt: Timestamp.fromMillis(NOW + HOUR),
    });
    expect(
      await command('s1', 'stats.recount', { target: null, reason: '' }, deps)
    ).toEqual({
      ok: true,
    });
    await command('s2', 'stats.refresh', { target: null, reason: '' }, deps);
    expect((await db.doc('adminStats/now').get()).data()).toMatchObject({
      accounts: 3,
      online: 1,
      playing: 1,
      roomsOpen: 1,
      matchesRunning: 1,
      uploadedPictures: 1,
      entries: { xp: 1, online: 1 },
    });
  });
});

describe('expireBans', () => {
  it('lifts a ban whose end has passed, audited as the system', async () => {
    await seedAda();
    const { deps } = fakeDeps();
    await db.doc('bans/ada').set({
      until: Timestamp.fromMillis(NOW - HOUR),
      reason: 'spam',
    });
    await db.doc('bans/bob').set({ until: null, reason: 'spam' });
    expect(await expireBans(db, deps, NOW)).toBe(1);
    expect((await db.doc('bans/ada').get()).exists).toBe(false);
    expect((await db.doc('bans/bob').get()).exists).toBe(true);
    const audit = await db
      .collection('adminAudit')
      .where('target.uid', '==', 'ada')
      .get();
    expect(audit.docs[0]?.get('by')).toBe('system');
  });
});

describe('the account functions', () => {
  it('counts a new account, and bans a banned Google identity again', async () => {
    const { deps } = fakeDeps({ ada: ADA_GOOGLE });
    await db.doc(`banTombstones/${tombstoneId('g-ada', KEY)}`).set({
      until: null,
      reason: 'cheating',
    });
    expect(
      await countAccount(db, deps, 'ada2', 'g-ada', NOW - HOUR, NOW)
    ).toEqual({ rebanned: true });
    expect(await countAccount(db, deps, 'bob', null, NOW, NOW)).toEqual({
      rebanned: false,
    });
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(2);
    expect((await db.doc('bans/ada2').get()).get('reason')).toBe('cheating');
  });

  it('checks a guest once Google is linked', async () => {
    const accounts: Record<string, AccountRecord> = {
      ada: { googleUid: null, admin: false },
    };
    const { deps } = fakeDeps(accounts);
    await db.doc(`banTombstones/${tombstoneId('g-ada', KEY)}`).set({
      until: null,
      reason: 'spam',
    });
    expect(await checkGoogleLink(db, deps, 'ada', NOW)).toEqual({
      rebanned: false,
    });
    // Looked up at most once an hour while a guest.
    expect(await checkGoogleLink(db, deps, 'ada', NOW + 1)).toBeNull();
    accounts['ada'] = ADA_GOOGLE;
    expect(await checkGoogleLink(db, deps, 'ada', NOW + 2 * HOUR)).toEqual({
      rebanned: true,
    });
    expect(await checkGoogleLink(db, deps, 'ada', NOW + 4 * HOUR)).toBeNull();
  });

  it("removes a deleted account's boards and keeps its ban", async () => {
    await seedAda();
    const { deps } = fakeDeps();
    await db.doc('stats/accounts').set({ total: 5 });
    await db.doc('bans/ada').set({ until: null, reason: 'cheating' });
    await db.doc('endlessRuns/ada_202610251').set({ uid: 'ada' });
    await db.doc('dailyRuns/2026-10-25_ada').set({ uid: 'ada' });
    await db.doc('players/ada/attempts/d_2026-10-25_1').set({ at: 1 });
    await db.doc('players/ada/notices/n1').set({ type: 'banned' });
    await db.doc('moderation/ada').set({ resets: 2 });
    await db.doc('adminAudit/a1').set({
      target: { uid: 'ada' },
      reason: "name 'Rude Name'",
      before: { name: 'Rude Name' },
      after: {},
    });
    expect(await deletePlayerBoards(db, deps, 'ada', 'g-ada', NOW)).toEqual({
      entries: 2,
      runs: 2,
      audit: 1,
    });
    for (const path of [
      'boards/xp/entries/ex',
      'boardMembers/ada',
      'bans/ada',
      'endlessRuns/ada_202610251',
      'dailyRuns/2026-10-25_ada',
      'players/ada/attempts/d_2026-10-25_1',
      'players/ada/notices/n1',
      'moderation/ada',
    ]) {
      expect((await db.doc(path).get()).exists).toBe(false);
    }
    expect((await db.doc('adminAudit/a1').get()).data()).toMatchObject({
      reason: '',
      before: { scrubbed: true },
    });
    expect(
      (await db.doc(`banTombstones/${tombstoneId('g-ada', KEY)}`).get()).exists
    ).toBe(true);
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(4);
  });
});
