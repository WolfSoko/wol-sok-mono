import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { clearBanCache, isBanned } from '../limits';
import { expireBans } from './bans';
import { type AdminContext, runAdminCommand } from './command';
import type { Realtime } from './realtime';

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
 * starts, `afterRemoveIf` once it is done - to let another command run in
 * between.
 */
function fakeRealtime(
  failFor?: string,
  hooks: {
    beforeRemoveIf?: () => Promise<unknown>;
    afterRemoveIf?: () => Promise<unknown>;
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

function context(
  realtime: Realtime = fakeRealtime(),
  owners: readonly string[] = ['owner']
): AdminContext {
  return { isOwner: async (uid) => owners.includes(uid), realtime };
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
  it.each([
    ['profile.reset', { uid: 'ada' }, {}],
    ['board.hideEntry', { boardId: 'xp', entryId: 'xpAda' }, { bar: true }],
    ['stats.refresh', null, {}],
  ])('answer %s with unsupported, audited', async (type, target, args) => {
    expect(await command('c1', { type, target, args })).toEqual({
      ok: false,
      error: 'unsupported',
    });
    expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
      type,
      ok: false,
      error: 'unsupported',
    });
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
