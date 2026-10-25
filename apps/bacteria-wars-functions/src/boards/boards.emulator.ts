import {
  onlineSort,
  XP_FULL_COUNT_BEFORE,
  xpSort,
} from '@wolsok/feat-lazy-bac-game/engine';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { clearBanCache } from '../limits';
import { deletePlayerReplays } from '../replays/delete-player';
import { boardProfileChanged } from './profile-changed';
import { type AccountCreatedAt, rankOnline } from './rank-online';
import { rankProgress } from './rank-progress';
import { rebuildTop } from './rebuild-top';

/**
 * The board functions against the Firestore emulator (`test-emulator`):
 * the XP and online boards, the top documents and the relabelling.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 3, 12);
const BEFORE_CUT = XP_FULL_COUNT_BEFORE - HOUR;
const AFTER_CUT = XP_FULL_COUNT_BEFORE + HOUR;

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

/** A stored progress worth `xp` from finished matches alone. */
const progressWorth = (xp: number) => ({
  json: JSON.stringify({ totals: { matchXp: xp } }),
});

async function entryOf(uid: string, kind: 'xp' | 'online') {
  const ids = (await db.doc(`boardMembers/${uid}`).get()).get('entryIds');
  return db.doc(`boards/${kind}/entries/${ids[kind]}`).get();
}

describe('rankProgress', () => {
  it('counts the XP of the stored progress, under the caps', async () => {
    const result = await rankProgress(
      db,
      'ada',
      progressWorth(40_000),
      AFTER_CUT,
      NOW
    );
    expect(result).toEqual({ counted: 2_000, claimed: 40_000 });
    const entry = await entryOf('ada', 'xp');
    expect(entry.data()).toMatchObject({
      sort: xpSort(2_000),
      status: 'counted',
      name: null,
      show: { xp: 2_000 },
    });
    const member = (await db.doc('boardMembers/ada').get()).data();
    expect(member).toMatchObject({ boards: ['xp'], xp: { counted: 2_000 } });
    expect(member?.['activeAt']).toBeDefined();
  });

  it('counts a player from before the boards in full, up to 25,000', async () => {
    expect(
      await rankProgress(db, 'ada', progressWorth(9_000), BEFORE_CUT, NOW)
    ).toMatchObject({ counted: 9_000 });
  });

  it('keeps the entry ids, and the board follows a reset down', async () => {
    await rankProgress(db, 'ada', progressWorth(9_000), BEFORE_CUT, NOW);
    const first = await entryOf('ada', 'xp');
    await rankProgress(db, 'ada', progressWorth(10), BEFORE_CUT, NOW + HOUR);
    const again = await entryOf('ada', 'xp');
    expect(again.id).toBe(first.id);
    expect(again.get('show')).toMatchObject({ xp: 10 });
  });

  it('shows the name with publicName, and hides an opted-out player', async () => {
    await db.doc('profiles/ada').set({ name: 'Ada', publicName: true });
    await rankProgress(db, 'ada', progressWorth(100), BEFORE_CUT, NOW);
    expect((await entryOf('ada', 'xp')).get('name')).toBe('Ada');
    await db.doc('profiles/bob').set({ name: 'Bob', boardOptOut: true });
    await rankProgress(db, 'bob', progressWorth(100), BEFORE_CUT, NOW);
    expect((await entryOf('bob', 'xp')).data()).toMatchObject({
      status: 'hidden',
      baseStatus: 'counted',
      hiddenBy: { optout: true },
    });
  });

  it('counts nothing for a banned player, or an unreadable progress', async () => {
    await db.doc('bans/eve').set({ until: null });
    expect(
      await rankProgress(db, 'eve', progressWorth(100), BEFORE_CUT, NOW)
    ).toBe('banned');
    expect(await rankProgress(db, 'ada', { json: '{' }, BEFORE_CUT, NOW)).toBe(
      'unreadable'
    );
  });
});

describe('rankOnline', () => {
  const OLD = async () => NOW - 30 * DAY;
  const replay = (extra: object = {}) => ({
    kind: 'online',
    state: 'agreed',
    room: 'ABC234',
    seats: ['ada', 'bob'],
    stubCreatedAt: Timestamp.fromMillis(NOW - HOUR),
    ticks: 3_600,
    endedBy: 'annihilation',
    winnerSeat: 0,
    ...extra,
  });
  async function rank(id: string, data: object, ages: AccountCreatedAt = OLD) {
    await db.doc(`replays/${id}`).set(data);
    return rankOnline(db, id, ages, NOW);
  }

  it('adds the win and the loss, once', async () => {
    expect(await rank('r1', replay())).toBe('counted');
    expect((await entryOf('ada', 'online')).data()).toMatchObject({
      sort: onlineSort(1, 0),
      show: { w: 1, l: 0, d: 0, nr: 0 },
    });
    expect((await entryOf('bob', 'online')).get('show')).toEqual({
      w: 0,
      l: 1,
      d: 0,
      nr: 0,
    });
    expect((await db.doc('replays/r1').get()).get('rankedReason')).toBe(
      'counted'
    );
    expect(await rankOnline(db, 'r1', OLD, NOW)).toBe('done');
    expect((await entryOf('ada', 'online')).get('show')).toMatchObject({
      w: 1,
    });
  });

  it('counts a match without a winner as a draw for both', async () => {
    await rank('r1', replay({ winnerSeat: null, endedBy: 'time' }));
    expect((await entryOf('ada', 'online')).get('show')).toMatchObject({
      d: 1,
    });
    expect((await entryOf('bob', 'online')).get('show')).toMatchObject({
      d: 1,
    });
  });

  it('counts nothing for a desync, a short match, a ban or a lost stub', async () => {
    expect(await rank('r1', replay({ endedBy: 'desync' }))).toBe('desync');
    expect(await rank('r2', replay({ ticks: 1_799 }))).toBe('short');
    expect(await rank('r3', replay({ stubExpired: true }))).toBe(
      'stub-expired'
    );
    await db.doc('bans/bob').set({ until: null });
    expect(await rank('r4', replay())).toBe('banned');
    expect((await db.doc('boardMembers/ada').get()).exists).toBe(false);
  });

  it('counts nothing without a uid in both seats, as after a deleted account', async () => {
    const data = replay({ players: ['ada', 'bob'] });
    await db.doc('replays/r1').set(data);
    // A retry an hour on: Bob deleted his account meanwhile.
    await deletePlayerReplays(db, 'bob');
    expect(await rankOnline(db, 'r1', OLD, NOW)).toBe('stub-expired');
    expect((await db.doc('boardMembers/bob').get()).exists).toBe(false);
    expect((await db.doc('replays/r1').get()).get('rankedReason')).toBe(
      'stub-expired'
    );
    // The same rule for a match stored without both seats.
    expect(await rank('r2', replay({ seats: ['ada'] }))).toBe('stub-expired');
    expect((await db.doc('boardMembers/ada').get()).exists).toBe(false);
  });

  it('counts no faster than the room could play', async () => {
    // Two hours of matches in a room that stood for one.
    expect(await rank('r1', replay({ ticks: 2 * 60 * 3_600 }))).toBe(
      'too-fast'
    );
  });

  it('counts three results per pair a day', async () => {
    for (const id of ['r1', 'r2', 'r3']) {
      expect(await rank(id, replay({ ticks: 1_800 }))).toBe('counted');
    }
    expect(await rank('r4', replay({ ticks: 1_800 }))).toBe('pair-cap');
  });

  it('counts five wins a day against new accounts, the losses always', async () => {
    const young = async (uid: string) =>
      uid === 'ada' ? NOW - 30 * DAY : NOW - DAY;
    await db
      .doc('boardMembers/ada')
      .set({ online: { day: '2026-11-03', wins: 2, newOpponentWins: 5 } });
    expect(await rank('r1', replay(), young)).toBe('counted');
    expect((await entryOf('ada', 'online')).get('show')).toMatchObject({
      w: 0,
    });
    expect((await entryOf('bob', 'online')).get('show')).toMatchObject({
      l: 1,
    });
  });
});

describe('rebuildTop', () => {
  const entry = (sort: number, status = 'counted') => ({
    sort,
    atHour: 1,
    status,
    name: null,
    tag: 1,
    avatar: 1,
    show: { xp: sort, rank: 'spore' },
  });

  it('writes the visible entries in board order, without hidden ones', async () => {
    await db.doc('boards/xp/entries/a').set(entry(5));
    await db.doc('boards/xp/entries/b').set(entry(9));
    await db.doc('boards/xp/entries/h').set(entry(99, 'hidden'));
    expect(await rebuildTop(db, 'xp', 'b', entry(9))).toBe('rebuilt');
    const top = (await db.doc('boards/xp').get()).data();
    expect(top).toMatchObject({ board: 'xp', cut: 0 });
    expect(
      top?.['rows'].map((row: { entryId: string }) => row.entryId)
    ).toEqual(['b', 'a']);
  });

  it('skips an entry that is neither in the top rows nor beats them', async () => {
    await db.doc('boards/xp').set({
      rows: Array.from({ length: 50 }, (_, i) => ({
        entryId: `e${i}`,
        sort: 100,
      })),
    });
    expect(await rebuildTop(db, 'xp', 'z', entry(5))).toBe('skipped');
    expect(await rebuildTop(db, 'bogus', 'z', entry(500))).toBe('skipped');
  });
});

describe('boardProfileChanged', () => {
  it('relabels the entries on every board of the player', async () => {
    await rankProgress(db, 'ada', progressWorth(100), BEFORE_CUT, NOW);
    const before = { name: 'Ada' };
    const after = { name: 'Ada', publicName: true };
    await db.doc('profiles/ada').set(after);
    expect(await boardProfileChanged(db, 'ada', before, after)).toBe(1);
    expect((await entryOf('ada', 'xp')).get('name')).toBe('Ada');
    const optedOut = { ...after, boardOptOut: true };
    await boardProfileChanged(db, 'ada', after, optedOut);
    expect((await entryOf('ada', 'xp')).get('status')).toBe('hidden');
    await boardProfileChanged(db, 'ada', optedOut, after);
    expect((await entryOf('ada', 'xp')).get('status')).toBe('counted');
  });

  it('takes the name off when the profile is deleted', async () => {
    const profile = { name: 'Ada', publicName: true };
    await db.doc('profiles/ada').set(profile);
    await rankProgress(db, 'ada', progressWorth(100), BEFORE_CUT, NOW);
    expect((await entryOf('ada', 'xp')).get('name')).toBe('Ada');
    await db.doc('profiles/ada').delete();
    expect(await boardProfileChanged(db, 'ada', profile, undefined)).toBe(1);
    expect((await entryOf('ada', 'xp')).get('name')).toBeNull();
  });

  it('ignores a change no row shows', async () => {
    expect(
      await boardProfileChanged(
        db,
        'ada',
        { name: 'A', motto: 'x' },
        { name: 'A', motto: 'y' }
      )
    ).toBe(0);
  });
});
