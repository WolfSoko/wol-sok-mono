import { createHash } from 'node:crypto';
import { defaultProfile } from '@wolsok/feat-lazy-bac-game/engine';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { clearBanCache, isBanned } from '../limits';
import { countAccount, deleteAccount } from './accounts';
import { expireBans } from './bans';
import { type AdminContext, runAdminCommand } from './command';
import type { Realtime } from './realtime';
import { refreshStats } from './stats';
import { checkGoogleLink } from './tombstones';

/**
 * The admin commands against the Firestore emulator (`test-emulator`):
 * bans and unbans with what they hide, clear out and tell, the owner check,
 * the types still to come, and the hourly clean-up of ended bans. The
 * Realtime Database is a fake that records what it was asked.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 3, 12);
const DAILY = 'daily-2026-11-03';

afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

/**
 * A Realtime Database that keeps its values and records its writes, and
 * fails for `failFor`. `beforeRemoveIf` runs when a conditional remove
 * starts, `afterRemoveIf` once it is done, `beforeGet` before a read - to
 * let another command run in between.
 */
function fakeRealtime(
  failFor?: string,
  hooks: {
    beforeRemoveIf?: () => Promise<unknown>;
    afterRemoveIf?: () => Promise<unknown>;
    beforeGet?: () => Promise<unknown>;
  } = {}
): Realtime & { calls: string[]; values: Map<string, number> } {
  const calls: string[] = [];
  const values = new Map<string, number>();
  const fail = (path: string) => {
    if (failFor !== undefined && path === `bans/${failFor}`) {
      throw new Error('unavailable');
    }
  };
  return {
    calls,
    values,
    get: async (path) => {
      await hooks.beforeGet?.();
      return values.get(path) ?? null;
    },
    set: async (path, value) => {
      calls.push(`set ${path} ${value}`);
      values.set(path, value);
    },
    remove: async (path) => {
      fail(path);
      calls.push(`remove ${path}`);
      values.delete(path);
    },
    removeIf: async (path, test) => {
      await hooks.beforeRemoveIf?.();
      fail(path);
      if (test(values.get(path) ?? null)) {
        calls.push(`remove ${path}`);
        values.delete(path);
      }
      await hooks.afterRemoveIf?.();
    },
  };
}

/** The tombstone id the fake Auth gives a Google account. */
const tombstoneOfUid = (uid: string) => `t-${uid}`;

function context(
  realtime: Realtime = fakeRealtime(),
  owners: readonly string[] = ['owner'],
  /** The accounts with a Google provider. */
  google: readonly string[] = []
): AdminContext {
  return {
    isOwner: async (uid) => owners.includes(uid),
    realtime,
    tombstoneOf: async (uid) =>
      google.includes(uid) ? tombstoneOfUid(uid) : null,
    countAccounts: async () => 7,
  };
}

/** Stores a command as the owner's client would, then runs it. */
async function command(
  id: string,
  fields: Record<string, unknown>,
  ctx: AdminContext = context(),
  /** Null for an unauthenticated writer. */
  authId: string | null = 'owner',
  now: number = NOW
) {
  const data = {
    uid: 'owner',
    reason: 'test',
    args: {},
    createdAt: Timestamp.fromMillis(now),
    expireAt: Timestamp.fromMillis(now + DAY),
    ...fields,
  };
  await db.doc(`adminCommands/${id}`).set(data);
  return runAdminCommand(db, id, data, authId ?? undefined, ctx, now);
}

const ban = (uid: string, until: number | null, extra: object = {}) => ({
  type: 'player.ban',
  target: { uid },
  args: { until, reason: 'cheating' },
  ...extra,
});

const unban = (uid: string) => ({ type: 'player.unban', target: { uid } });

/** Ada on the XP and a daily board, her daily entry opted out too. */
async function seedAda(): Promise<void> {
  await db.doc('boardMembers/ada').set({
    entryIds: { xp: 'xpAda', online: 'onAda', daily: 'dAda', endless: 'enAda' },
    boards: ['xp', DAILY],
  });
  await db.doc('profiles/ada').set({ name: 'Ada', publicName: true });
  await db.doc('boards/xp/entries/xpAda').set({
    sort: 900,
    atHour: 1,
    status: 'counted',
    baseStatus: 'counted',
    hiddenBy: {},
    show: { xp: 900 },
  });
  await db.doc(`boards/${DAILY}/entries/dAda`).set({
    sort: 500,
    atHour: 2,
    status: 'hidden',
    baseStatus: 'verified',
    hiddenBy: { admin: true },
    show: { ticks: 500, won: true },
    expireAt: Timestamp.fromMillis(NOW + 31 * DAY),
  });
}

const entry = (path: string) => db.doc(path).get();

describe('player.ban', () => {
  it('bans a player, hides their entries and tells them', async () => {
    await seedAda();
    const realtime = fakeRealtime();
    const until = NOW + 7 * DAY;
    expect(await command('c1', ban('ada', until), context(realtime))).toEqual({
      ok: true,
    });

    const stored = (await db.doc('bans/ada').get()).data();
    expect(stored?.['until'].toMillis()).toBe(until);
    expect(stored?.['since'].toMillis()).toBe(NOW);
    expect(stored?.['reason']).toBe('cheating');
    // The player-readable ban names no admin.
    expect(Object.keys(stored ?? {}).sort()).toEqual([
      'reason',
      'since',
      'until',
    ]);
    expect(await isBanned(db, 'ada', NOW)).toBe(true);
    expect(realtime.calls).toEqual(
      expect.arrayContaining([
        `set bans/ada ${until}`,
        'remove status/ada',
        'remove connections/ada',
      ])
    );

    expect((await entry('boards/xp/entries/xpAda')).data()).toMatchObject({
      status: 'hidden',
      baseStatus: 'counted',
      hiddenBy: { ban: true },
    });
    const daily = (await entry(`boards/${DAILY}/entries/dAda`)).data();
    expect(daily).toMatchObject({ hiddenBy: { admin: true, ban: true } });
    // Updated in place: the daily entry keeps its TTL.
    expect(daily?.['expireAt'].toMillis()).toBe(NOW + 31 * DAY);

    expect((await db.doc('players/ada/notices/c1').get()).data()).toMatchObject(
      { type: 'banned', reason: 'cheating' }
    );
    expect((await db.doc('moderation/ada').get()).get('bans')).toBe(1);

    const audit = (await db.doc('adminAudit/c1').get()).data();
    expect(audit).toMatchObject({
      by: 'owner',
      type: 'player.ban',
      target: { uid: 'ada' },
      reason: 'test',
      before: null,
      after: { reason: 'cheating' },
      ok: true,
      source: 'adminCommand',
    });
    expect(audit?.['expireAt'].toMillis()).toBe(NOW + 2 * 365 * DAY);
    expect(
      (await db.doc('adminCommands/c1').get()).get('result')
    ).toMatchObject({ ok: true });
  });

  it('takes the player out of what others meet them in', async () => {
    await db.doc('queue/ada').set({ claim: null });
    await db.doc('queue/bob').set({ claim: null });
    await db.doc('rooms/ABC234').set({ host: 'ada' });
    // A stub: Bob's report of their match is checked against it.
    await db
      .doc('rooms/GHJ892')
      .set({ host: 'ada', guest: 'bob', taken: true });
    await db.doc('rooms/DEF567').set({ host: 'bob' });
    await db.doc('invites/one').set({ from: 'ada' });
    await db.doc('invites/two').set({ from: 'bob' });
    await db.doc('players/bob/challenges/ada').set({ code: 'ABC234' });
    await db.doc('players/bob/requests/ada').set({ at: Timestamp.now() });
    await db.doc('players/ada/requests/bob').set({ at: Timestamp.now() });
    await db
      .doc('publicReplays/p1')
      .set({ replayId: 'r1', uids: ['ada', 'bob'], removedAt: null });
    await db.doc('replays/r1').set({ players: ['ada', 'bob'] });

    await command('c1', ban('ada', null));

    const exists = async (path: string) => (await db.doc(path).get()).exists;
    expect(await exists('queue/ada')).toBe(false);
    expect(await exists('rooms/ABC234')).toBe(false);
    expect(await exists('invites/one')).toBe(false);
    expect(await exists('rooms/GHJ892')).toBe(true);
    // Challenges expire within the hour; requests lead nowhere now.
    expect(await exists('players/bob/challenges/ada')).toBe(true);
    expect(await exists('players/bob/requests/ada')).toBe(true);
    // What others made stays.
    expect(await exists('queue/bob')).toBe(true);
    expect(await exists('rooms/DEF567')).toBe(true);
    expect(await exists('invites/two')).toBe(true);
    expect(await exists('players/ada/requests/bob')).toBe(true);

    expect(
      (await db.doc('publicReplays/p1').get()).get('removedAt')
    ).toBeInstanceOf(Timestamp);
    expect((await db.doc('replays/r1').get()).data()).toMatchObject({
      optOut: ['ada'],
      galleryOut: true,
    });
  });

  it('finds the player behind a board entry', async () => {
    await seedAda();
    expect(
      await command(
        'c1',
        ban('ada', null, { target: { boardId: 'xp', entryId: 'xpAda' } })
      )
    ).toEqual({ ok: true });
    expect((await db.doc('bans/ada').get()).get('until')).toBeNull();
    expect((await db.doc('adminAudit/c1').get()).get('target')).toEqual({
      boardId: 'xp',
      entryId: 'xpAda',
      uid: 'ada',
    });

    expect(
      await command(
        'c2',
        ban('ada', null, { target: { boardId: 'xp', entryId: 'nobody' } })
      )
    ).toEqual({ ok: false, error: 'not-found' });
  });

  it('changes only the end and reason of a ban that holds', async () => {
    await seedAda();
    await command('c1', ban('ada', NOW + DAY));
    const later = NOW + HOUR;
    expect(
      await command(
        'c2',
        ban('ada', null, { args: { until: null, reason: 'spam' } }),
        context(),
        'owner',
        later
      )
    ).toEqual({ ok: true });
    const stored = (await db.doc('bans/ada').get()).data();
    expect(stored).toMatchObject({ until: null, reason: 'spam' });
    expect(stored?.['since'].toMillis()).toBe(NOW);
    expect((await db.doc('players/ada/notices/c2').get()).exists).toBe(false);
    expect((await db.doc('moderation/ada').get()).get('bans')).toBe(1);
    expect((await db.doc('adminAudit/c2').get()).data()).toMatchObject({
      before: { reason: 'cheating' },
      after: { reason: 'spam', until: null },
    });
  });

  it('refuses an end that has passed', async () => {
    expect(await command('c1', ban('ada', NOW - 1))).toEqual({
      ok: false,
      error: 'ended',
    });
    expect((await db.doc('bans/ada').get()).exists).toBe(false);
  });

  it('runs a command once', async () => {
    await seedAda();
    const ctx = context();
    await command('c1', ban('ada', null), ctx);
    // A second delivery of the same command answers, and changes nothing.
    await db.doc('bans/ada').delete();
    const data = (await db.doc('adminCommands/c1').get()).data() ?? {};
    expect(await runAdminCommand(db, 'c1', data, 'owner', ctx, NOW)).toEqual({
      ok: true,
    });
    expect((await db.doc('bans/ada').get()).exists).toBe(false);
    expect((await db.doc('moderation/ada').get()).get('bans')).toBe(1);
  });

  it('leaves a command another delivery still runs alone', async () => {
    // The first delivery claimed the audit and has not finished.
    await db.doc('adminAudit/c1').set({ ok: null });
    expect(await command('c1', ban('ada', null))).toBeNull();
    expect((await db.doc('bans/ada').get()).exists).toBe(false);
    expect((await db.doc('adminCommands/c1').get()).get('result')).toBe(
      undefined
    );
  });
});

describe('player.unban', () => {
  it('lifts the ban and brings back only what the ban hid', async () => {
    await seedAda();
    const realtime = fakeRealtime();
    await command('c1', ban('ada', null), context(realtime));
    expect(await command('c2', unban('ada'), context(realtime))).toEqual({
      ok: true,
    });

    expect((await db.doc('bans/ada').get()).exists).toBe(false);
    expect(realtime.calls).toContain('remove bans/ada');
    clearBanCache();
    expect(await isBanned(db, 'ada', NOW)).toBe(false);

    expect((await entry('boards/xp/entries/xpAda')).data()).toMatchObject({
      status: 'counted',
      hiddenBy: {},
      // Named again, as the profile shows the name in public.
      name: 'Ada',
    });
    // The owner's own hide stays.
    expect((await entry(`boards/${DAILY}/entries/dAda`)).data()).toMatchObject({
      status: 'hidden',
      hiddenBy: { admin: true },
    });

    expect((await db.doc('players/ada/notices/c2').get()).get('type')).toBe(
      'unbanned'
    );
    expect((await db.doc('adminAudit/c2').get()).data()).toMatchObject({
      type: 'player.unban',
      before: { reason: 'cheating', until: null },
      after: null,
      ok: true,
    });
  });

  it('says so for a player who is not banned, and clears the mirror', async () => {
    const realtime = fakeRealtime();
    // Left behind by a ban command that failed after Firestore.
    await realtime.set('bans/ada', 0);
    expect(await command('c1', unban('ada'), context(realtime))).toEqual({
      ok: false,
      error: 'not-banned',
    });
    expect(realtime.values.has('bans/ada')).toBe(false);
  });

  it.each(['beforeGet', 'beforeRemoveIf'] as const)(
    'never removes the mirror of a ban set while it clears one (%s)',
    async (hook) => {
      await seedAda();
      const until = NOW + DAY;
      const realtime = fakeRealtime(undefined, {
        [hook]: () => command('c2', ban('ada', until), context(realtime)),
      });
      // Left behind by a ban command that failed after Firestore.
      await realtime.set('bans/ada', 0);
      expect(await command('c1', unban('ada'), context(realtime))).toEqual({
        ok: false,
        error: 'not-banned',
      });
      expect(realtime.values.get('bans/ada')).toBe(until);
      expect(realtime.calls).not.toContain('remove bans/ada');
      expect((await entry('boards/xp/entries/xpAda')).get('hiddenBy')).toEqual({
        ban: true,
      });
    }
  );

  it('leaves a ban that changed while it ran', async () => {
    await seedAda();
    const realtime = fakeRealtime(undefined, {
      beforeRemoveIf: () =>
        command('c2', ban('ada', NOW + DAY), context(realtime)),
    });
    await command('c1', ban('ada', null), context(realtime));
    expect(await command('c3', unban('ada'), context(realtime))).toEqual({
      ok: false,
      error: 'ban-changed',
    });
    expect(realtime.values.get('bans/ada')).toBe(NOW + DAY);
    expect((await db.doc('bans/ada').get()).get('until').toMillis()).toBe(
      NOW + DAY
    );
    expect((await entry('boards/xp/entries/xpAda')).get('hiddenBy')).toEqual({
      ban: true,
    });
  });
});

describe('the owner check', () => {
  it('refuses anybody but the owner, without an audit', async () => {
    expect(
      await command('c1', ban('ada', null, { uid: 'eve' }), context(), 'eve')
    ).toEqual({ ok: false, error: 'not-admin' });
    expect(await command('c2', ban('ada', null), context(), 'eve')).toEqual({
      ok: false,
      error: 'not-writer',
    });
    expect(await command('c3', ban('ada', null), context(), null)).toEqual({
      ok: false,
      error: 'not-writer',
    });
    // A claim revoked since the rules let the command in.
    expect(
      await command('c4', ban('ada', null), context(fakeRealtime(), []))
    ).toEqual({ ok: false, error: 'not-admin' });

    expect((await db.doc('bans/ada').get()).exists).toBe(false);
    expect((await db.collection('adminAudit').get()).empty).toBe(true);
    expect(
      (await db.doc('adminCommands/c1').get()).get('result')
    ).toMatchObject({ ok: false, error: 'not-admin' });
  });

  it('refuses a command that is not exactly one', async () => {
    expect(await command('c1', ban('ada', null, { extra: true }))).toEqual({
      ok: false,
      error: 'malformed',
    });
    expect(await command('c2', ban('ada', null, { reason: '' }))).toEqual({
      ok: false,
      error: 'malformed',
    });
  });
});

describe('the types still to come', () => {
  it.each([['board.verify', { boardId: DAILY, entryId: 'dAda' }, {}]])(
    'answer %s with unsupported, audited',
    async (type, target, args) => {
      expect(await command('c1', { type, target, args })).toEqual({
        ok: false,
        error: 'unsupported',
      });
      expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
        type,
        ok: false,
        error: 'unsupported',
      });
    }
  );
});

describe('statistics', () => {
  /** Two players connected, one of them in a match. */
  const connected = (): Realtime => ({
    ...fakeRealtime(),
    get: async (path) =>
      path === 'connections'
        ? {
            ada: { state: 'playing', at: NOW },
            bob: { state: 'online', at: NOW },
          }
        : null,
  });
  const at = (ms: number) => Timestamp.fromMillis(ms);

  async function seedFigures(): Promise<void> {
    await seedAda();
    await db.doc('stats/accounts').set({ total: 12 });
    await db.doc('boardMembers/bob').set({ activeAt: at(NOW - 3 * DAY) });
    await db.doc('boardMembers/ada').update({ activeAt: at(NOW - HOUR) });
    await db.doc('queue/bob').set({ seen: at(NOW - 10_000) });
    await db.doc('queue/old').set({ seen: at(NOW - 60_000) });
    await db.doc('rooms/r1').set({ taken: true, expireAt: at(NOW + HOUR) });
    await db.doc('rooms/r2').set({ expireAt: at(NOW + HOUR) });
    await db.doc('rooms/gone').set({ expireAt: at(NOW - HOUR) });
    await db.doc('replays/old').set({ createdAt: at(NOW - 2 * DAY) });
    await db.doc('replays/new').set({ createdAt: at(NOW - HOUR) });
    await db.doc('replaySubmissions/s1').set({ uid: 'bob' });
    await db.doc('bans/eve').set({ until: null, reason: 'cheating' });
    await db.doc('profiles/bob').set({ avatar: { kind: 'image' } });
    await db.doc('counters/2026-11-03').set({ verifyMs: 4000, label: 'x' });
  }

  it('writes the overview on stats.refresh, audited', async () => {
    await seedFigures();
    const ctx = { ...context(), realtime: connected() };
    expect(
      await command('c1', { type: 'stats.refresh', target: null }, ctx)
    ).toEqual({ ok: true });
    const figures = {
      accounts: 12,
      active24h: 1,
      active7d: 2,
      online: 2,
      playing: 1,
      searching: 1,
      roomsOpen: 1,
      matchesRunning: 1,
      replays: 2,
      replaysToday: 1,
      submissionsWaiting: 1,
      bans: 1,
      uploadedPictures: 1,
      entries: { xp: 1, online: 0, endless: 0, [DAILY]: 1 },
      today: { verifyMs: 4000 },
    };
    expect((await db.doc('adminStats/now').get()).data()).toMatchObject(
      figures
    );
    expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
      ok: true,
      target: null,
      after: figures,
    });
  });

  it('keeps an hourly snapshot 90 days', async () => {
    await refreshStats(db, connected(), NOW + 5 * 60_000, { snapshot: true });
    const snapshot = await db.doc('adminStats/h_2026110312').get();
    expect(snapshot.get('online')).toBe(2);
    expect((snapshot.get('expireAt') as Timestamp).toMillis()).toBe(
      NOW + 5 * 60_000 + 90 * DAY
    );
    expect((await db.doc('adminStats/now').get()).exists).toBe(true);
  });

  it('sets the account count from Auth on stats.recount', async () => {
    await db.doc('stats/accounts').set({ total: 3 });
    expect(
      await command('c1', { type: 'stats.recount', target: null })
    ).toEqual({ ok: true });
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(7);
    expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
      before: 3,
      after: 7,
    });
  });
});

describe('profile moderation', () => {
  const image = 'data:image/webp;base64,AAAA';
  const seedProfile = (avatar: Record<string, unknown>) =>
    db.doc('profiles/ada').set({
      name: 'Rude',
      motto: 'rude too',
      avatar,
      shareStatus: false,
      publicName: true,
    });

  it('resets a profile, keeps what it shares, and tells the player', async () => {
    await seedProfile({ kind: 'image', data: image });
    expect(
      await command('c1', { type: 'profile.reset', target: { uid: 'ada' } })
    ).toEqual({ ok: true });
    const fresh = defaultProfile('ada');
    expect((await db.doc('profiles/ada').get()).data()).toMatchObject({
      name: fresh.name,
      motto: '',
      avatar: fresh.avatar,
      shareStatus: false,
      publicName: true,
    });
    expect((await db.doc('players/ada/notices/c1').get()).get('type')).toBe(
      'profile-reset'
    );
    expect((await db.doc('moderation/ada').get()).get('resets')).toBe(1);
    const audit = (await db.doc('adminAudit/c1').get()).data();
    // The image's fingerprint, never the image.
    expect(audit?.['before']).toEqual({
      name: 'Rude',
      motto: 'rude too',
      avatar: {
        kind: 'image',
        sha256: createHash('sha256').update(image).digest('hex'),
        size: image.length,
      },
    });
  });

  it('removes a picture only, and refuses a drawn one', async () => {
    await seedProfile({ kind: 'preset', id: 3 });
    const remove = { type: 'profile.removeImage', target: { uid: 'ada' } };
    expect(await command('c1', remove)).toEqual({
      ok: false,
      error: 'no-image',
    });
    await seedProfile({ kind: 'image', data: image });
    expect(await command('c2', remove)).toEqual({ ok: true });
    expect((await db.doc('profiles/ada').get()).data()).toMatchObject({
      name: 'Rude',
      avatar: defaultProfile('ada').avatar,
    });
    expect((await db.doc('players/ada/notices/c2').get()).get('type')).toBe(
      'image-removed'
    );
    expect((await db.doc('moderation/ada').get()).get('imageRemovals')).toBe(1);
  });

  it('resets a profile once, and copes with one without a motto', async () => {
    await db
      .doc('profiles/ada')
      .set({ name: 'Rude', avatar: { kind: 'photo' } });
    const reset = { type: 'profile.reset', target: { uid: 'ada' } };
    expect(await command('c1', reset)).toEqual({ ok: true });
    expect((await db.doc('adminAudit/c1').get()).get('before')).toEqual({
      name: 'Rude',
      motto: '',
      avatar: { kind: 'photo' },
    });
    expect(await command('c2', reset)).toEqual({
      ok: false,
      error: 'unchanged',
    });
    expect((await db.doc('moderation/ada').get()).get('resets')).toBe(1);
  });

  it('says so for a player without a profile', async () => {
    expect(
      await command('c1', { type: 'profile.reset', target: { uid: 'bob' } })
    ).toEqual({ ok: false, error: 'not-found' });
  });
});

describe('board moderation', () => {
  const xp = { boardId: 'xp', entryId: 'xpAda' };

  it('hides one entry and bars its board, and tells the player', async () => {
    await seedAda();
    expect(
      await command('c1', {
        type: 'board.hideEntry',
        target: xp,
        args: { bar: true },
      })
    ).toEqual({ ok: true });
    expect((await entry('boards/xp/entries/xpAda')).data()).toMatchObject({
      status: 'hidden',
      hiddenBy: { admin: true },
    });
    expect((await db.doc('boardMembers/ada').get()).get('barred')).toEqual([
      'xp',
    ]);
    expect((await db.doc('players/ada/notices/c1').get()).get('type')).toBe(
      'board-hidden'
    );
    expect((await db.doc('moderation/ada').get()).get('hides')).toBe(1);
    expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
      target: { ...xp, uid: 'ada' },
      before: { barred: [] },
      after: { barred: ['xp'], entries: 1 },
    });
  });

  it("hides all a player's entries, found by one of them", async () => {
    await seedAda();
    await db.doc(`boards/${DAILY}/entries/dAda`).update({
      status: 'verified',
      hiddenBy: {},
    });
    expect(
      await command('c1', { type: 'board.hidePlayer', target: xp })
    ).toEqual({ ok: true });
    for (const path of [
      'boards/xp/entries/xpAda',
      `boards/${DAILY}/entries/dAda`,
    ]) {
      expect((await entry(path)).get('hiddenBy')).toEqual({ admin: true });
    }
    // No bar without asking.
    expect((await db.doc('boardMembers/ada').get()).get('barred')).toBe(
      undefined
    );
  });

  it('restores what the owner hid and barred, not what a ban hides', async () => {
    await seedAda();
    await command('c1', {
      type: 'board.hidePlayer',
      target: { uid: 'ada' },
      args: { bar: true },
    });
    await command('c2', ban('ada', null));
    expect(
      await command('c3', { type: 'board.restore', target: { uid: 'ada' } })
    ).toEqual({ ok: true });
    expect((await db.doc('boardMembers/ada').get()).get('barred')).toEqual([]);
    expect((await entry('boards/xp/entries/xpAda')).data()).toMatchObject({
      status: 'hidden',
      hiddenBy: { ban: true },
    });
    await command('c4', unban('ada'));
    expect((await entry('boards/xp/entries/xpAda')).data()).toMatchObject({
      status: 'counted',
      hiddenBy: {},
    });
    expect((await entry(`boards/${DAILY}/entries/dAda`)).data()).toMatchObject({
      status: 'verified',
      hiddenBy: {},
    });
  });

  it('restores one entry and lifts only its bar', async () => {
    await seedAda();
    await command('c1', {
      type: 'board.hidePlayer',
      target: { uid: 'ada' },
      args: { bar: true },
    });
    await command('c2', { type: 'board.restore', target: xp });
    expect((await db.doc('boardMembers/ada').get()).get('barred')).toEqual([
      'online',
      'daily',
      'endless',
    ]);
    expect((await entry('boards/xp/entries/xpAda')).get('hiddenBy')).toEqual(
      {}
    );
    expect(
      (await entry(`boards/${DAILY}/entries/dAda`)).get('hiddenBy')
    ).toEqual({ admin: true });
  });

  it('tells and counts a hide only once it changed something', async () => {
    await seedAda();
    const hide = { type: 'board.hideEntry', target: xp };
    await command('c1', hide);
    expect(await command('c2', hide)).toEqual({ ok: true });
    expect((await db.doc('players/ada/notices/c2').get()).exists).toBe(false);
    expect((await db.doc('moderation/ada').get()).get('hides')).toBe(1);
  });

  it('bars the daily boards with every daily entry the player has', async () => {
    await seedAda();
    const yesterday = 'daily-2026-11-02';
    await db.doc('boardMembers/ada').update({
      boards: ['xp', yesterday, DAILY],
    });
    await db.doc(`boards/${yesterday}/entries/dAda`).set({
      sort: 400,
      atHour: 1,
      status: 'verified',
      baseStatus: 'verified',
      hiddenBy: {},
      show: { ticks: 400, won: true },
    });
    await command('c1', {
      type: 'board.hideEntry',
      target: { boardId: DAILY, entryId: 'dAda' },
      args: { bar: true },
    });
    expect(
      (await entry(`boards/${yesterday}/entries/dAda`)).get('hiddenBy')
    ).toEqual({ admin: true });
    expect((await entry('boards/xp/entries/xpAda')).get('hiddenBy')).toEqual(
      {}
    );
    // Lifting the bar brings them all back.
    await command('c2', {
      type: 'board.restore',
      target: { boardId: DAILY, entryId: 'dAda' },
    });
    expect(
      (await entry(`boards/${yesterday}/entries/dAda`)).get('status')
    ).toBe('verified');
  });

  it("says so for an entry on a board the player isn't on", async () => {
    await seedAda();
    expect(
      await command('c1', {
        type: 'board.hideEntry',
        target: { boardId: 'daily-2026-11-02', entryId: 'dAda' },
      })
    ).toEqual({ ok: false, error: 'not-on-board' });
  });
});

describe('expireBans', () => {
  it('lifts the bans that ended, audited by the system', async () => {
    await seedAda();
    const realtime = fakeRealtime();
    await command('c1', ban('ada', NOW + DAY), context(realtime));
    await command('c2', ban('bob', null), context(realtime));
    await command('c3', ban('cy', NOW + 3 * DAY), context(realtime));

    const later = NOW + 2 * DAY;
    expect(await expireBans(db, realtime, later)).toBe(1);

    expect((await db.doc('bans/ada').get()).exists).toBe(false);
    expect((await db.doc('bans/bob').get()).exists).toBe(true);
    expect((await db.doc('bans/cy').get()).exists).toBe(true);
    expect(realtime.calls).toContain('remove bans/ada');
    expect((await entry('boards/xp/entries/xpAda')).get('status')).toBe(
      'counted'
    );
    const id = `ban-ended_ada_${NOW + DAY}`;
    expect((await db.doc(`adminAudit/${id}`).get()).data()).toMatchObject({
      by: 'system',
      type: 'player.unban',
      target: { uid: 'ada' },
      source: 'system',
      ok: true,
    });
    expect((await db.doc(`players/ada/notices/${id}`).get()).get('type')).toBe(
      'unbanned'
    );
    // Nothing left to lift.
    expect(await expireBans(db, realtime, later)).toBe(0);
  });

  it.each(['beforeRemoveIf', 'afterRemoveIf'] as const)(
    'keeps a ban the owner sets while it lifts the old one (%s)',
    async (hook) => {
      await seedAda();
      const later = NOW + DAY;
      const renewed = later + 3 * DAY;
      const realtime = fakeRealtime(undefined, {
        [hook]: () =>
          command('c2', ban('ada', renewed), context(realtime), 'owner', later),
      });
      await command('c1', ban('ada', NOW + HOUR), context(realtime));

      expect(await expireBans(db, realtime, later)).toBe(0);

      const stored = (await db.doc('bans/ada').get()).data();
      expect(stored?.['until'].toMillis()).toBe(renewed);
      expect(stored?.['since'].toMillis()).toBe(later);
      expect(realtime.values.get('bans/ada')).toBe(renewed);
      // Only the ended ban's value is removed, and only before the new one.
      expect(realtime.calls.includes('remove bans/ada')).toBe(
        hook === 'afterRemoveIf'
      );
      expect((await entry('boards/xp/entries/xpAda')).data()).toMatchObject({
        status: 'hidden',
        hiddenBy: { ban: true },
      });
      const notices = await db.collection('players/ada/notices').get();
      expect(notices.docs.map((doc) => doc.get('type'))).toEqual([
        'banned',
        'banned',
      ]);
      expect((await db.collection('adminAudit').get()).size).toBe(2);
    }
  );

  it('clears a mirror out of step with the ended ban', async () => {
    const realtime = fakeRealtime();
    await command('c1', ban('ada', NOW + HOUR), context(realtime));
    // An end the Realtime Database kept from before, already passed.
    await realtime.set('bans/ada', NOW + 30 * 60_000);
    expect(await expireBans(db, realtime, NOW + DAY)).toBe(1);
    expect(realtime.values.has('bans/ada')).toBe(false);
  });

  it('goes on past a ban it cannot lift', async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const realtime = fakeRealtime('ada');
    await command('c1', ban('ada', NOW + HOUR), context(realtime));
    await command('c2', ban('bob', NOW + 2 * HOUR), context(realtime));
    expect(await expireBans(db, realtime, NOW + DAY)).toBe(1);
    expect((await db.doc('bans/bob').get()).exists).toBe(false);
    // Left for the next run, which tries it again.
    expect((await db.doc('bans/ada').get()).exists).toBe(true);
  });
});

describe('ban tombstones', () => {
  const YEAR = 365 * DAY;
  const tombstone = (uid: string) =>
    db.doc(`banTombstones/${tombstoneOfUid(uid)}`).get();
  const google = context(fakeRealtime(), ['owner'], ['ada']);

  it('come with the ban of a Google account and go with its unban', async () => {
    const until = NOW + 7 * DAY;
    await command('c1', ban('ada', until), google);
    expect((await tombstone('ada')).data()).toEqual({
      until: Timestamp.fromMillis(until),
      reason: 'cheating',
      expireAt: Timestamp.fromMillis(until),
    });
    await command('c2', unban('ada'), google);
    expect((await tombstone('ada')).exists).toBe(false);
  });

  it('go with the unban of a player who unlinked Google since', async () => {
    await command('c1', ban('ada', null), google);
    // The fake Auth now finds no Google provider.
    await command('c2', unban('ada'));
    expect((await tombstone('ada')).exists).toBe(false);
    expect((await db.doc('moderation/ada').get()).get('tombstones')).toBe(
      undefined
    );
  });

  it('go with the unban for every Google account the ban followed', async () => {
    await command('c1', ban('ada', null), google);
    // Ada swaps Google accounts, and the owner changes the ban.
    const swapped: AdminContext = {
      ...context(),
      tombstoneOf: async () => 't-ada-2',
    };
    await command('c2', ban('ada', null, { reason: 'spam' }), swapped);
    expect((await db.collection('banTombstones').get()).size).toBe(2);
    await command('c3', unban('ada'));
    expect((await db.collection('banTombstones').get()).size).toBe(0);
  });

  it('keep a permanent ban 2 years, and follow no guest', async () => {
    await command('c1', ban('ada', null), google);
    expect((await tombstone('ada')).get('expireAt')).toEqual(
      Timestamp.fromMillis(NOW + 2 * YEAR)
    );
    await command('c2', ban('bob', null), google);
    expect((await db.collection('banTombstones').get()).size).toBe(1);
  });

  describe('countAccount', () => {
    const until = NOW + 7 * DAY;
    const seedTombstone = (end: number | null) =>
      db.doc('banTombstones/t-new').set({
        until: end === null ? null : Timestamp.fromMillis(end),
        reason: 'spam',
        expireAt: Timestamp.fromMillis(NOW + DAY),
      });

    it('counts a guest once and notes when it was made', async () => {
      await db.doc('stats/accounts').set({ total: 4 });
      const count = () =>
        countAccount(
          db,
          fakeRealtime(),
          'eve',
          { createdAt: NOW, tombstone: null },
          NOW
        );
      expect(await count()).toBe(false);
      // The same event delivered again.
      await count();
      expect((await db.doc('stats/accounts').get()).get('total')).toBe(5);
      expect((await db.doc('boardMembers/eve').get()).data()).toEqual({
        accountCounted: true,
        accountCreatedAt: Timestamp.fromMillis(NOW),
      });
    });

    it('bans a Google sign-up its tombstone names, audited by the system', async () => {
      await seedTombstone(until);
      const realtime = fakeRealtime();
      expect(
        await countAccount(
          db,
          realtime,
          'eve',
          { createdAt: NOW, tombstone: 't-new' },
          NOW
        )
      ).toBe(true);
      expect((await db.doc('bans/eve').get()).data()).toMatchObject({
        until: Timestamp.fromMillis(until),
        reason: 'spam',
      });
      expect(realtime.values.get('bans/eve')).toBe(until);
      expect(
        (await db.doc('adminAudit/tombstone_eve').get()).data()
      ).toMatchObject({
        by: 'system',
        type: 'player.ban',
        source: 'system',
        ok: true,
      });
      expect(
        (await db.doc('players/eve/notices/tombstone_eve').get()).get('type')
      ).toBe('banned');
      expect(
        (await db.doc('boardMembers/eve').get()).get('googleChecked')
      ).toBe(true);
    });

    it('leaves a Google sign-up alone once its tombstone ended', async () => {
      await seedTombstone(NOW - HOUR);
      expect(
        await countAccount(
          db,
          fakeRealtime(),
          'eve',
          { createdAt: NOW, tombstone: 't-new' },
          NOW
        )
      ).toBe(false);
      expect((await db.doc('bans/eve').get()).exists).toBe(false);
    });
  });

  describe('checkGoogleLink', () => {
    it('checks once, after the guest linked Google', async () => {
      await db.doc('banTombstones/t-eve').set({
        until: null,
        reason: 'cheating',
        expireAt: Timestamp.fromMillis(NOW + DAY),
      });
      let linked = false;
      let lookups = 0;
      const tombstoneOf = async (uid: string) => {
        lookups++;
        return linked ? tombstoneOfUid(uid) : null;
      };
      const realtime = fakeRealtime();
      const check = (at: number) =>
        checkGoogleLink(db, realtime, 'eve', tombstoneOf, at);

      expect(await check(NOW)).toBe(false);
      expect((await db.doc('bans/eve').get()).exists).toBe(false);
      linked = true;
      // A guest is looked up once an hour at most.
      expect(await check(NOW + HOUR - 1)).toBe(false);
      expect(lookups).toBe(1);
      expect(await check(NOW + HOUR)).toBe(true);
      expect((await db.doc('bans/eve').get()).get('until')).toBeNull();
      // Checked: the next write looks nothing up.
      expect(await check(NOW + 2 * HOUR)).toBe(false);
      expect(lookups).toBe(2);
    });
  });

  describe('deleteAccount', () => {
    it("keeps a banned Google account's ban as a tombstone, and erases the rest", async () => {
      const realtime = fakeRealtime();
      const until = NOW + 30 * DAY;
      // Banned while a guest: the deletion writes the tombstone.
      await command('c1', ban('ada', until), context(realtime));
      await db.doc('stats/accounts').set({ total: 3 });
      await db.doc('boardMembers/ada').set({ accountCounted: true });

      await deleteAccount(
        db,
        'ada',
        { tombstone: tombstoneOfUid('ada'), realtime },
        NOW + DAY
      );

      expect((await tombstone('ada')).data()).toMatchObject({
        until: Timestamp.fromMillis(until),
        reason: 'cheating',
      });
      expect((await db.doc('bans/ada').get()).exists).toBe(false);
      expect(realtime.values.has('bans/ada')).toBe(false);
      expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
        target: { uid: 'ada' },
        type: 'player.ban',
        before: { scrubbed: true },
        after: { scrubbed: true },
      });
      expect((await db.doc('stats/accounts').get()).get('total')).toBe(2);
    });

    it('finds the tombstone by the id the ban noted, once Google is unlinked', async () => {
      const realtime = fakeRealtime();
      await command(
        'c1',
        ban('ada', null),
        context(realtime, ['owner'], ['ada'])
      );
      // Gone meanwhile, as if never written.
      await db.doc(`banTombstones/${tombstoneOfUid('ada')}`).delete();
      await deleteAccount(db, 'ada', { tombstone: null, realtime }, NOW + DAY);
      expect((await tombstone('ada')).get('reason')).toBe('cheating');
      expect((await db.doc('bans/ada').get()).exists).toBe(false);
    });

    it('lowers the count only for an account countAccount counted', async () => {
      await db.doc('stats/accounts').set({ total: 3 });
      await db.doc('boardMembers/ada').set({ entryIds: {} });
      await deleteAccount(
        db,
        'ada',
        { tombstone: null, realtime: fakeRealtime() },
        NOW
      );
      expect((await db.doc('stats/accounts').get()).get('total')).toBe(3);
    });

    it('writes no tombstone for an account whose ban ended', async () => {
      await command('c1', ban('ada', NOW + HOUR));
      await deleteAccount(
        db,
        'ada',
        { tombstone: tombstoneOfUid('ada'), realtime: fakeRealtime() },
        NOW + DAY
      );
      expect((await tombstone('ada')).exists).toBe(false);
    });
  });
});
