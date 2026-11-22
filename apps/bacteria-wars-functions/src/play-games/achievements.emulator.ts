import { ACHIEVEMENTS } from '@wolsok/feat-shared-bacteria-engine';
import { logger } from 'firebase-functions/logger';
import { PROGRESS_KEY } from '../boards/rank-progress';
import { useEmulatorDb } from '../testing/emulator';
import {
  type FakeGamesSetup,
  fakeGamesApi,
} from '../testing/fake-play-games-api';
import { syncPlayGamesAchievements } from './achievements';

/**
 * The achievement sync against the Firestore emulator (`test-emulator`):
 * the stored progress and the ban are real, the Games API is faked.
 */
const db = useEmulatorDb();

const NOW = Date.UTC(2026, 11, 1, 12);

const nameOf = (id: string) =>
  ACHIEVEMENTS.find((achievement) => achievement.id === id)?.name ?? id;
const onPlay = (...ids: string[]) =>
  ids.map((id) => ({ id: `P-${id}`, name: nameOf(id) }));

async function storeProgress(uid: string, ...earned: string[]) {
  const achievements = Object.fromEntries(
    earned.map((id) => [id, '2026-11-20'])
  );
  await db
    .doc(`players/${uid}/storage/${PROGRESS_KEY}`)
    .set({ json: JSON.stringify({ achievements }) });
}

function sync(setup: FakeGamesSetup, uid = 'a') {
  const fake = fakeGamesApi(setup);
  return {
    calls: fake.calls,
    outcome: syncPlayGamesAchievements(db, uid, fake.games, NOW),
  };
}

describe('syncPlayGamesAchievements', () => {
  let info: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
    warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('unlocks the earned achievements Play still shows locked', async () => {
    await storeProgress('a', 'first-blood', 'pacifist', 'blitz');
    const { calls, outcome } = sync({
      definitions: onPlay('first-blood', 'pacifist', 'blitz', 'siege'),
      states: { 'P-first-blood': 'UNLOCKED', 'P-pacifist': 'REVEALED' },
    });

    expect(await outcome).toEqual({
      unlocked: ['Pacifist', 'Blitz'],
      failed: [],
      missing: [],
      ambiguous: [],
    });
    expect(calls).toEqual([
      'definitions',
      'states',
      'unlock P-pacifist',
      'unlock P-blitz',
    ]);
  });

  it('skips and logs an earned achievement Play does not list', async () => {
    await storeProgress('a', 'first-blood', 'lab-member');
    const { calls, outcome } = sync({ definitions: onPlay('first-blood') });

    expect(await outcome).toMatchObject({
      unlocked: ['First Blood'],
      missing: [nameOf('lab-member')],
    });
    expect(calls).not.toContain('unlock P-lab-member');
    expect(info).toHaveBeenCalledWith(
      'Play Games achievements synced',
      expect.objectContaining({ missing: [nameOf('lab-member')] })
    );
  });

  it('syncs nothing for a banned account, and logs it', async () => {
    await storeProgress('a', 'first-blood');
    await db.doc('bans/a').set({ reason: 'cheating', until: null });
    const { calls, outcome } = sync({ definitions: onPlay('first-blood') });

    expect(await outcome).toBe('banned');
    expect(calls).toEqual([]);
    expect(info).toHaveBeenCalledWith(
      'Play Games achievements not synced: the account is banned'
    );
  });

  it('calls no Games API for an account without progress or achievements', async () => {
    const none = sync({ definitions: onPlay('first-blood') });
    expect(await none.outcome).toBe('nothing-earned');
    expect(none.calls).toEqual([]);

    await storeProgress('b');
    const empty = sync({ definitions: onPlay('first-blood') }, 'b');
    expect(await empty.outcome).toBe('nothing-earned');
    expect(empty.calls).toEqual([]);
  });

  it('goes on after a failed unlock and logs a refused scope as its own case', async () => {
    await storeProgress('a', 'first-blood', 'pacifist', 'blitz');
    const { calls, outcome } = sync({
      definitions: onPlay('first-blood', 'pacifist', 'blitz'),
      failUnlock: {
        'P-first-blood': 'throw',
        'P-pacifist': { status: 403, scope: true },
      },
    });

    expect(await outcome).toMatchObject({
      unlocked: ['Blitz'],
      failed: ['First Blood', 'Pacifist'],
    });
    expect(calls).toContain('unlock P-blitz');
    expect(warn).toHaveBeenCalledWith(
      'Play Games refused the token’s scope for achievements',
      { call: 'unlock', status: 403 }
    );
  });

  it.each([
    [
      'definitions',
      true,
      'Play Games refused the token’s scope for achievements',
    ],
    ['states', false, 'Play Games refused to list achievements'],
  ] as const)(
    'stops when Google refuses to list the %s',
    async (call, scope, message) => {
      await storeProgress('a', 'first-blood');
      const { calls, outcome } = sync({
        definitions: onPlay('first-blood'),
        refuse: { call, status: 403, scope },
      });

      expect(await outcome).toEqual({ refused: call, status: 403, scope });
      expect(calls.filter((each) => each.startsWith('unlock'))).toEqual([]);
      expect(warn).toHaveBeenCalledWith(message, { call, status: 403 });
    }
  );
});
