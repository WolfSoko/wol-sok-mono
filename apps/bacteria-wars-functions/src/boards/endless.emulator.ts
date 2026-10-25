import {
  endlessSort,
  type Replay,
  replayToBytes,
} from '@wolsok/feat-lazy-bac-game/engine';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { clearBanCache } from '../limits';
import { voidAttempt } from '../replays/accept';
import { endlessReplay, RUN_ID, TICKS } from '../testing/daily-replay';
import {
  closeStaleMatches,
  rankEndless,
  trackDeclaredMatch,
} from './rank-endless';
import { type Verdict } from './verify';
import { verifyEndlessSlice } from './verify-endless';
import { verifyNow } from './verify-now';

/**
 * The endless board against the Firestore emulator (`test-emulator`):
 * runs computed from their declared matches, in any order, the sweep of
 * matches without a replay and the verification of a run's wins.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const AT0 = Date.UTC(2026, 9, 25, 10);
/** When match `i` of a run was declared: ten minutes apart. */
const atOf = (i: number) => AT0 + i * 10 * MINUTE;
/** A minute after the match ended. */
const arrivalOf = (i: number) => atOf(i) + 5_000 + 2 * MINUTE;
const NOW = AT0 + 3 * HOUR;

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

/** Declares match `i` of a run of Ada's, as the client does. */
async function declare(i: number, runId = RUN_ID) {
  await db
    .doc(`players/ada/attempts/e_${runId}_${i}`)
    .set({ at: Timestamp.fromMillis(atOf(i)) });
}

/**
 * Stores a replay of a declared match as acceptReplay would, and ranks it
 * when it comes - seconds after it was sent, unless `now` says otherwise.
 */
async function rank(replayId: string, replay: Replay, now?: number) {
  const attempt = replay.header.attempt;
  if (attempt === undefined) {
    throw new Error('A ranked replay carries its attempt');
  }
  const i = Number(attempt.id.split('_')[2]);
  const doc = {
    kind: 'endless',
    players: ['ada'],
    state: 'submitted',
    attempt,
    submittedAt: Timestamp.fromMillis(arrivalOf(i)),
  };
  await db.doc(`replays/${replayId}`).set(doc);
  await db
    .doc(`replays/${replayId}/blob/data`)
    .set({ bytes: Buffer.from(await replayToBytes(replay)) });
  return rankEndless(db, replayId, doc, now ?? arrivalOf(i));
}

/** Match `i` of run `runId`, played on the level after `wins` wins. */
const played = (i: number, wins: number, won = true, runId = RUN_ID) =>
  endlessReplay(
    i,
    atOf(i),
    atOf(0),
    wins,
    won ? {} : { outcome: { endedBy: 'annihilation', winnerSeat: 1 } },
    'ada',
    runId
  );

async function entry() {
  const ids = (await db.doc('boardMembers/ada').get()).get('entryIds');
  return db.doc(`boards/endless/entries/${ids.endless}`).get();
}
const run = async (runId = RUN_ID) =>
  (await db.doc(`endlessRuns/ada_${runId}`).get()).data();

describe('rankEndless', () => {
  it('takes a won match into the run and onto the board, provisional', async () => {
    await declare(0);
    expect(await rank('l_0', played(0, 0))).toBe('counted');
    expect((await entry()).data()).toMatchObject({
      sort: endlessSort(1, TICKS / 60),
      status: 'provisional',
      show: { depth: 1, seconds: 60 },
    });
    expect(await run()).toMatchObject({ wins: 1, lives: 3, verifiedWins: 0 });
    expect((await db.doc('boardMembers/ada').get()).get('endless')).toEqual({
      runId: RUN_ID,
    });
  });

  it('takes replays in any order, and refuses a match on the wrong level', async () => {
    for (const i of [0, 1, 2]) {
      await declare(i);
    }
    // Match 2's replay comes first, while 0 and 1 may still come.
    const soon = arrivalOf(2);
    expect(await rank('l_2', played(2, 1), soon)).toBe('counted');
    expect(await rank('l_1', played(1, 0, false), soon)).toBe('counted');
    expect(await rank('l_0', played(0, 0), soon)).toBe('counted');
    expect(await run()).toMatchObject({ wins: 2, lives: 2 });
    await declare(3);
    // Match 3 replays the first level although the run is two wins deep.
    expect(await rank('l_3', played(3, 0))).toBe('level');
    expect(await run()).toMatchObject({ wins: 2, lives: 1 });
    expect(await rank('l_3b', played(3, 2))).toBe('duplicate');
  });

  it('keeps its answer when rankReplay delivers a replay again', async () => {
    await declare(0);
    expect(await rank('l_0', played(0, 0))).toBe('counted');
    const doc = (await db.doc('replays/l_0').get()).data() ?? {};
    // A retry after the first delivery wrote everything.
    expect(await rankEndless(db, 'l_0', doc, NOW)).toBe('counted');
    expect((await db.doc('replays/l_0').get()).get('rankedReason')).toBe(
      'counted'
    );
    await db.doc('replays/l_0').delete();
    expect(await rankEndless(db, 'l_0', doc, NOW)).toBe('gone');
    expect(await run()).toMatchObject({ wins: 1, lives: 3 });
  });

  it('counts a voided match as not played, and the run goes on', async () => {
    await declare(0);
    expect(await rank('l_0', played(0, 0))).toBe('counted');
    await declare(1);
    await trackDeclaredMatch(db, 'ada', `e_${RUN_ID}_1`, arrivalOf(1));
    expect(await run()).toMatchObject({ pendingAt: atOf(1) });
    // Its submission was dropped on the server's side.
    await voidAttempt(
      db,
      { uid: 'ada', attempt: `e_${RUN_ID}_1`, createdAt: arrivalOf(1) },
      'cap',
      NOW
    );
    expect(await run()).toMatchObject({ wins: 1, lives: 3, pendingAt: null });
    await declare(2);
    expect(await rank('l_2', played(2, 1))).toBe('counted');
    expect(await run()).toMatchObject({ wins: 2, lives: 3 });
    expect(Object.keys((await run())?.['declared'] ?? {})).toEqual(['0', '2']);
  });

  it('keeps the seed of a run whose void match 0 TTL took', async () => {
    await declare(0);
    await voidAttempt(
      db,
      { uid: 'ada', attempt: `e_${RUN_ID}_0`, createdAt: arrivalOf(0) },
      'error',
      NOW
    );
    await db.doc(`players/ada/attempts/e_${RUN_ID}_0`).delete();
    await declare(1);
    expect(await rank('l_1', played(1, 0))).toBe('counted');
    expect(await run()).toMatchObject({ wins: 1, lives: 3 });
  });

  it('waits for a match within 2 hours, and the sweep then counts it lost', async () => {
    await declare(0);
    await declare(1);
    // Two hours after match 0 its replay may still come.
    expect(await rank('l_1', played(1, 0), atOf(0) + HOUR)).toBe('counted');
    expect(await run()).toMatchObject({ wins: 0, pendingAt: atOf(0) });
    expect((await entry()).exists).toBe(false);
    expect(await closeStaleMatches(db, NOW)).toBe(1);
    expect(await run()).toMatchObject({ wins: 1, lives: 2, pendingAt: null });
    expect((await entry()).get('show')).toEqual({ depth: 1, seconds: 60 });
  });

  it('counts a declared match lost when no replay ever comes', async () => {
    await declare(0);
    await trackDeclaredMatch(db, 'ada', `e_${RUN_ID}_0`, atOf(0));
    expect(await run()).toMatchObject({ lives: 3, pendingAt: atOf(0) });
    expect(await closeStaleMatches(db, NOW)).toBe(1);
    expect(await run()).toMatchObject({ lives: 2, pendingAt: null });
    expect(await trackDeclaredMatch(db, 'ada', 'd_2026-10-25_1', NOW)).toBe(
      null
    );
  });

  it('remembers a declared match after its attempt document is gone', async () => {
    await declare(0);
    await declare(1);
    await rank('l_1', played(1, 0), atOf(0) + HOUR);
    // TTL takes match 0's declaration before the sweep sees it lost.
    await db.doc(`players/ada/attempts/e_${RUN_ID}_0`).delete();
    await closeStaleMatches(db, NOW);
    expect(await run()).toMatchObject({ wins: 1, lives: 2 });
  });

  it("keeps the player's best run on the board, and a TTL on the others", async () => {
    const second = '202610252';
    await declare(0);
    await rank('l_a0', played(0, 0));
    for (const i of [0, 1]) {
      await declare(i, second);
    }
    await rank('l_b0', played(0, 0, true, second));
    await rank('l_b1', played(1, 1, true, second));
    expect((await entry()).get('show')).toMatchObject({ depth: 2 });
    expect((await db.doc('boardMembers/ada').get()).get('endless')).toEqual({
      runId: second,
    });
    expect((await run())?.['expireAt']).toBeInstanceOf(Timestamp);
    expect((await run(second))?.['expireAt']).toBeUndefined();
  });
});

describe('verifyEndlessSlice', () => {
  const old = async () => ({ createdAt: AT0 - 30 * 24 * HOUR, google: true });
  /** Confirms the first match, refutes the rest. */
  const verify = (replay: Replay): Verdict =>
    replay.header.attempt?.id === `e_${RUN_ID}_0`
      ? { state: 'verified', ms: 0 }
      : { state: 'unverified', ms: 0 };

  it('plays the wins again in order and cuts the run at a failed one', async () => {
    for (const i of [0, 1, 2]) {
      await declare(i);
      await rank(`l_${i}`, played(i, i));
    }
    expect((await entry()).get('show')).toMatchObject({ depth: 3 });
    let t = 0;
    const result = await verifyEndlessSlice(
      db,
      NOW,
      old,
      25 * MINUTE,
      () => (t += 1_000),
      verify
    );
    expect(result.checked).toBe(2);
    expect(await run()).toMatchObject({ verifiedWins: 1, cut: 1, over: true });
    expect((await entry()).data()).toMatchObject({
      status: 'verified',
      show: { depth: 1, seconds: 60, partial: true },
    });
    expect((await db.doc('replays/l_0').get()).get('state')).toBe('verified');
    expect((await db.doc('replays/l_1').get()).get('state')).toBe('unverified');
    expect((await db.doc('moderation/ada').get()).get('failedChecks')).toBe(1);
  });

  it('leaves a run uncut when its replay is of another balance table', async () => {
    await declare(0);
    await rank('l_0', played(0, 0));
    const result = await verifyEndlessSlice(
      db,
      NOW,
      old,
      25 * MINUTE,
      () => 0,
      () => ({ state: 'balance-mismatch', ms: 0 })
    );
    expect(result.checked).toBe(1);
    expect(await run()).toMatchObject({ verifiedWins: 0, cut: null });
    expect((await entry()).get('status')).toBe('provisional');
    expect((await db.doc('replays/l_0').get()).get('state')).toBe(
      'balance-mismatch'
    );
  });
});

describe('verifyNow on an endless run', () => {
  it('plays what fits, and queues the rest first for the hourly slice', async () => {
    for (const i of [0, 1, 2]) {
      await declare(i);
      await rank(`l_${i}`, played(i, i));
    }
    // The clock runs fast: one win fits in the command's 10 match-minutes.
    let t = 0;
    const result = await verifyNow(
      db,
      'ada',
      { kind: 'endless' },
      NOW,
      () => (t += 150_000),
      () => ({ state: 'verified', ms: 0 })
    );
    expect(result).toMatchObject({ checked: 1, queued: true });
    expect((await run())?.['verifiedWins']).toBe(1);
    expect(
      (await db.doc('moderation/ada').get())
        .get('endlessFirstUntil')
        ?.toMillis()
    ).toBe(NOW + 24 * HOUR);
  });

  it('answers no-budget, and queues nothing, when no win fits', async () => {
    await declare(0);
    await rank('l_0', played(0, 0));
    await db.doc('counters/2026-10-25').set({ adminVerifyMs: 399_000 });
    expect(
      await verifyNow(
        db,
        'ada',
        { kind: 'endless' },
        NOW,
        () => 0,
        () => ({ state: 'verified', ms: 0 })
      )
    ).toBe('no-budget');
    expect((await run())?.['verifiedWins'] ?? 0).toBe(0);
    expect((await db.doc('moderation/ada').get()).exists).toBe(false);
  });

  it('says so for a player without a run', async () => {
    expect(
      await verifyNow(
        db,
        'bob',
        { kind: 'endless' },
        NOW,
        () => 0,
        () => ({ state: 'verified', ms: 0 })
      )
    ).toBe('nothing-to-verify');
  });
});
