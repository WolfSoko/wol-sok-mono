import {
  dailySort,
  type Replay,
  replayToBytes,
} from '@wolsok/feat-lazy-bac-game/engine';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { clearBanCache } from '../limits';
import { AT, ATTEMPT, dailyReplay, TICKS } from '../testing/daily-replay';
import { closeNotReported, finalizeDailyBoards } from './hourly';
import { rankDaily } from './rank-daily';
import { type Verdict } from './verify';
import { verifyDailySlice } from './verify-slice';

/**
 * The daily board against the Firestore emulator (`test-emulator`):
 * declared attempts into `dailyRuns` and the board, the verification slice
 * and the hourly sweeps.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 25, 12);
const DAY = '2026-10-25';
const BOARD = `daily-${DAY}`;
/** A minute after the match ended. */
const ARRIVED = AT + 5_000 + 60_000 + 60_000;

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

/**
 * Stores a replay of a declared attempt as acceptReplay would, declared
 * by `uid` at `at`, and ranks it.
 */
async function rank(
  replayId: string,
  replay: Replay,
  uid: string,
  { declared = true, arrived = ARRIVED } = {}
) {
  const attempt = replay.header.attempt;
  if (attempt === undefined) {
    throw new Error('A ranked replay carries its attempt');
  }
  if (declared) {
    await db
      .doc(`players/${uid}/attempts/${attempt.id}`)
      .set({ at: Timestamp.fromMillis(attempt.at) });
  }
  const doc = {
    kind: 'daily',
    players: [uid],
    state: 'submitted',
    attempt,
    submittedAt: Timestamp.fromMillis(arrived),
  };
  await db.doc(`replays/${replayId}`).set(doc);
  await db
    .doc(`replays/${replayId}/blob/data`)
    .set({ bytes: Buffer.from(await replayToBytes(replay)) });
  return rankDaily(db, replayId, doc, NOW);
}

async function entryOf(uid: string) {
  const ids = (await db.doc(`boardMembers/${uid}`).get()).get('entryIds');
  return db.doc(`boards/${BOARD}/entries/${ids.daily}`).get();
}

const lost = (ticks = TICKS) =>
  ({ ticks, outcome: { endedBy: 'annihilation', winnerSeat: 1 } }) as const;

describe('rankDaily', () => {
  it('takes a declared attempt onto the board, provisional', async () => {
    expect(await rank('l_1', dailyReplay(), 'ada')).toBe('counted');
    expect((await entryOf('ada')).data()).toMatchObject({
      sort: dailySort(true, TICKS),
      status: 'provisional',
      name: null,
      show: { ticks: TICKS, won: true },
    });
    expect((await db.doc('boardMembers/ada').get()).get('boards')).toEqual([
      BOARD,
    ]);
    expect(
      (await db.doc(`dailyRuns/${DAY}_ada`).get()).get('attempts')
    ).toEqual([
      expect.objectContaining({
        attemptId: ATTEMPT,
        replayId: 'l_1',
        state: 'provisional',
      }),
    ]);
    expect((await db.doc('replays/l_1').get()).get('rankedReason')).toBe(
      'counted'
    );
  });

  it("keeps the player's best attempt, and counts each attempt once", async () => {
    const second = 'd_2026-10-25_2';
    await rank('l_1', dailyReplay(lost()), 'ada');
    await rank('l_2', dailyReplay({}, 'ada', second, AT + HOUR), 'ada', {
      arrived: ARRIVED + HOUR,
    });
    expect((await entryOf('ada')).get('sort')).toBe(dailySort(true, TICKS));
    expect(await rank('l_3', dailyReplay(), 'ada')).toBe('duplicate');
    expect(
      (await db.doc(`dailyRuns/${DAY}_ada`).get()).get('attempts')
    ).toHaveLength(2);
  });

  it('takes the same replay delivered again as done, not as a duplicate', async () => {
    // rankReplay retries: a second delivery after the first one committed.
    expect(await rank('l_1', dailyReplay(), 'ada')).toBe('counted');
    const doc = (await db.doc('replays/l_1').get()).data() ?? {};
    expect(await rankDaily(db, 'l_1', doc, NOW)).toBe('counted');
    expect((await db.doc('replays/l_1').get()).get('rankedReason')).toBe(
      'counted'
    );
    expect(
      (await db.doc(`dailyRuns/${DAY}_ada`).get()).get('attempts')
    ).toHaveLength(1);
  });

  it('stores but never ranks an undeclared, late or forged replay', async () => {
    expect(await rank('l_1', dailyReplay(), 'ada', { declared: false })).toBe(
      'no-attempt'
    );
    expect(
      await rank('l_2', dailyReplay(), 'ada', { arrived: AT + 2 * HOUR })
    ).toBe('late');
    expect(await rank('l_3', dailyReplay({ difficulty: 'easy' }), 'ada')).toBe(
      'plan-mismatch'
    );
    expect((await db.doc('replays/l_2').get()).get('rankedReason')).toBe(
      'late'
    );
    expect((await db.doc('boardMembers/ada').get()).exists).toBe(false);
  });

  it('ranks nothing for a banned player', async () => {
    await db.doc('bans/eve').set({ until: null });
    expect(await rank('l_1', dailyReplay({}, 'eve'), 'eve')).toBe('banned');
  });
});

describe('verifyDailySlice', () => {
  const old = async () => ({ createdAt: NOW - 30 * 24 * HOUR, google: true });
  /** Verifies Ada's replays, refutes everyone else's. */
  const verify = (replay: Replay): Verdict =>
    replay.header.seed === dailyReplay().header.seed
      ? {
          state: 'verified',
          ms: 0,
          summary: {
            ticks: TICKS,
            endedBy: 'annihilation',
            winnerSeat: 0,
            sizes: [40, 0],
            timeline: [1, 1],
          },
        }
      : { state: 'unverified', ms: 0 };
  const slice = () => {
    let t = 0;
    return verifyDailySlice(db, NOW, old, () => (t += 1_000), verify);
  };

  it('verifies the candidates, and a refuted entry falls back', async () => {
    await rank('l_ada', dailyReplay(), 'ada');
    await rank('l_bob', dailyReplay({}, 'bob'), 'bob');
    expect(await slice()).toMatchObject({ checked: 2 });
    expect((await entryOf('ada')).get('status')).toBe('verified');
    expect((await db.doc('replays/l_ada').get()).data()).toMatchObject({
      state: 'verified',
      summary: { sizes: [40, 0] },
    });
    expect((await db.doc('moderation/ada').get()).get('verifiedBefore')).toBe(
      true
    );
    // Bob had one attempt: refuted, his entry is gone.
    expect((await entryOf('bob')).exists).toBe(false);
    expect((await db.doc('replays/l_bob').get()).get('state')).toBe(
      'unverified'
    );
    expect((await db.doc('moderation/bob').get()).get('failedChecks')).toBe(1);
    expect(
      Number((await db.doc(`counters/${DAY}`).get()).get('verifyMs'))
    ).toBeGreaterThan(0);
  });

  it('skips an account with two failed checks in a week', async () => {
    await rank('l_bob', dailyReplay({}, 'bob'), 'bob');
    // A second attempt keeps an entry on the board after the first fails.
    const second = 'd_2026-10-25_2';
    await rank('l_bob2', dailyReplay(lost(), 'bob', second, AT + HOUR), 'bob', {
      arrived: ARRIVED + HOUR,
    });
    await db
      .doc('moderation/bob')
      .set({ failedAt: [NOW - 24 * HOUR], failedChecks: 1 });
    await slice();
    expect(
      (await db.doc('moderation/bob').get()).get('skipUntil')
    ).toBeInstanceOf(Timestamp);
    expect((await entryOf('bob')).get('status')).toBe('provisional');
    expect(await slice()).toMatchObject({ checked: 0 });
  });

  it('applies a check once when two slices run at the same time', async () => {
    await rank('l_bob', dailyReplay({}, 'bob'), 'bob');
    await Promise.all([slice(), slice()]);
    // One failed check, not two: a single failure skips nobody.
    const moderation = (await db.doc('moderation/bob').get()).data();
    expect(moderation?.['failedChecks']).toBe(1);
    expect(moderation?.['failedAt']).toEqual([NOW]);
    expect(moderation?.['skipUntil']).toBeUndefined();
  });

  it('spends nothing once the day is spent', async () => {
    await rank('l_ada', dailyReplay(), 'ada');
    await db.doc(`counters/${DAY}`).set({ verifyMs: 20 * 60_000 });
    expect(await slice()).toEqual({ checked: 0, spentMs: 0 });
    expect((await entryOf('ada')).get('status')).toBe('provisional');
  });
});

describe('closeNotReported', () => {
  const waiting = (createdAt: number, extra: object = {}) => ({
    kind: 'online',
    state: 'waiting',
    players: ['ada'],
    seats: ['ada', 'bob'],
    endedBy: 'annihilation',
    ticks: 3_600,
    createdAt: Timestamp.fromMillis(createdAt),
    ...extra,
  });
  const onlineEntry = async (uid: string) => {
    const ids = (await db.doc(`boardMembers/${uid}`).get()).get('entryIds');
    return db.doc(`boards/online/entries/${ids.online}`).get();
  };

  it("adds a not reported match to the other player's record, once", async () => {
    await db.doc('replays/r1').set(waiting(NOW - 3 * HOUR));
    expect(await closeNotReported(db, NOW)).toBe(1);
    expect((await onlineEntry('bob')).get('show')).toEqual({
      w: 0,
      l: 0,
      d: 0,
      nr: 1,
    });
    expect((await db.doc('replays/r1').get()).get('rankedReason')).toBe(
      'not-reported'
    );
    expect(await closeNotReported(db, NOW)).toBe(0);
  });

  it('closes a short match without a mark, and leaves a fresh one', async () => {
    await db.doc('replays/r1').set(waiting(NOW - 3 * HOUR, { ticks: 100 }));
    await db.doc('replays/r2').set(waiting(NOW - HOUR));
    expect(await closeNotReported(db, NOW)).toBe(1);
    expect((await db.doc('boardMembers/bob').get()).exists).toBe(false);
    expect((await db.doc('replays/r2').get()).get('rankedReason')).toBe(
      undefined
    );
  });
});

describe('finalizeDailyBoards', () => {
  it("closes yesterday's board at 23:00 UTC", async () => {
    await db.doc('boards/daily-2026-10-24').set({ rows: [] });
    expect(await finalizeDailyBoards(db, Date.UTC(2026, 9, 25, 22))).toBeNull();
    expect(await finalizeDailyBoards(db, Date.UTC(2026, 9, 25, 23))).toBe(
      'daily-2026-10-24'
    );
    expect((await db.doc('boards/daily-2026-10-24').get()).get('final')).toBe(
      true
    );
  });
});
