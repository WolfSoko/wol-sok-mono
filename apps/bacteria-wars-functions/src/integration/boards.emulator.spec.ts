import { Timestamp } from 'firebase-admin/firestore';
import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import type { Account } from '../accounts';
import { AdminDeps, runAdminCommand } from '../admin/admin-command';
import { countAccount, deletePlayerBoards } from '../admin/account-events';
import {
  applyTombstone,
  banPlayer,
  checkGoogleLink,
  forgetGuestLooks,
  Moderation,
  unbanPlayer,
} from '../admin/bans';
import { writeStats } from '../admin/stats';
import { tombstoneKey } from '../admin/tombstones';
import { boardProfileChanged } from '../boards/board-profile-changed';
import {
  closeAttempts,
  closeWaitingOnline,
  expireBans,
  finaliseDailyBoards,
  runHourly,
} from '../boards/hourly';
import type { EntryDoc, MemberDoc } from '../boards/model';
import { countOnline } from '../boards/rank-online';
import { rankProgress } from '../boards/rank-progress';
import { rankReplay } from '../boards/rank-replay';
import { updateEndlessRun } from '../boards/ranked';
import { rebuildTop } from '../boards/rebuild-top';
import {
  applyRerun,
  candidatesOf,
  recordFailure,
  Slice,
  verifyDaily,
  verifyRun,
} from '../boards/verification';
import { Engine, loadEngine } from '../engine';
import { forgetBans } from '../limits';
import { fixedPool, GPU_INT_COST } from '../replays/budgets';
import { acceptSubmission } from '../replays/accept-replay';
import { levelStatsId } from '../replays/derive';
import type { ReplayDoc } from '../replays/model';
import { emulatorFirestore, fakeAccounts } from '../testing/emulator';
import { MemoryPresence } from '../testing/presence';
import { bytesOf, rankedReplay } from '../testing/replays';
import { dayOf } from '../time';

/**
 * The board functions' cores (ADR 0012) against the Firestore emulator:
 * transactions with queries, `create()` markers, `count()`, the caps.
 * Run by `nx run bacteria-wars-functions:test-integration`.
 */

const NOW = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;
const TODAY = dayOf(NOW);
const db = emulatorFirestore('boards');
const KEY = tombstoneKey('a-test-secret-of-sufficient-length');

let engine: Engine;
let presence: MemoryPresence;
/** What a test says of an account, on top of the defaults. */
const extraAccounts: Record<string, Partial<Account>> = {};

beforeAll(async () => {
  engine = await loadEngine();
});

beforeEach(() => {
  forgetBans();
  forgetGuestLooks();
  presence = new MemoryPresence();
  for (const uid of Object.keys(extraAccounts)) {
    delete extraAccounts[uid];
  }
});

/** Accounts as Auth would answer: guests a month old, unless said otherwise. */
const accounts = fakeAccounts(
  (uid) => ({
    anonymous: true,
    createdAt: NOW - 30 * DAY,
    admin: uid === 'owner',
    googleUid: null,
  }),
  extraAccounts
);

function moderation(): Moderation {
  return { db, engine: loadEngine, presence, accounts, tombstones: KEY };
}

function adminDeps(users: string[] = []): AdminDeps {
  return {
    ...moderation(),
    users: {
      listUsers: async () =>
        ({ users: users.map((uid) => ({ uid })) }) as never,
    },
  };
}

async function member(uid: string): Promise<MemberDoc> {
  return (await db.doc(`boardMembers/${uid}`).get()).data() as MemberDoc;
}

async function entry(
  uid: string,
  boardId: string,
  kind: 'xp' | 'online' | 'daily' | 'endless'
): Promise<EntryDoc | undefined> {
  const { entryIds } = await member(uid);
  return (
    await db.doc(`boards/${boardId}/entries/${entryIds[kind]}`).get()
  ).data() as EntryDoc | undefined;
}

/** The level of a run's match after `wins` won ones. */
function runLevel(seed: number, wins: number): string {
  return engine.endlessLevelId({ seed, wins, lives: 0 });
}

function progress(matchXp: number): Record<string, unknown> {
  return { json: JSON.stringify({ totals: { matchXp } }) };
}

describe('rankProgress', () => {
  it('counts the XP of the stored progress, capped like a human could earn it', async () => {
    const created = engine.XP_FULL_COUNT_BEFORE + DAY;
    expect(
      await rankProgress(moderation(), 'ana', progress(5_000), created, NOW)
    ).toEqual({ counted: 2_000, claimed: 5_000 });
    const xp = await entry('ana', 'xp', 'xp');
    expect(xp).toEqual(
      expect.objectContaining({
        sort: 2_000,
        status: 'counted',
        name: null,
        show: { xp: 2_000, rank: engine.rankFor(2_000).rank.id },
      })
    );
    expect(JSON.stringify(xp)).not.toContain('ana');
    // An hour later 3,000 more are allowed.
    expect(
      await rankProgress(
        moderation(),
        'ana',
        progress(5_000),
        created,
        NOW + HOUR
      )
    ).toEqual({ counted: 5_000, claimed: 5_000 });
    expect((await member('ana')).activeAt?.toMillis()).toBe(NOW + HOUR);
  });

  it('counts up to 25,000 at once for progress from before the launch', async () => {
    expect(
      await rankProgress(
        moderation(),
        'old',
        progress(30_000),
        engine.XP_FULL_COUNT_BEFORE - DAY,
        NOW
      )
    ).toEqual({ counted: 25_000, claimed: 30_000 });
  });

  it('follows a reset progress down, and ignores banned and barred players', async () => {
    await rankProgress(moderation(), 'ana', progress(1_000), NOW, NOW);
    await rankProgress(moderation(), 'ana', progress(10), NOW, NOW + 1);
    expect((await entry('ana', 'xp', 'xp'))?.sort).toBe(10);
    await db.doc('bans/ana').set({
      since: Timestamp.fromMillis(NOW),
      until: null,
      reason: 'cheating',
    });
    forgetBans();
    expect(
      await rankProgress(moderation(), 'ana', progress(900), NOW, NOW + 2)
    ).toEqual({ skipped: 'banned' });
    await db.doc('boardMembers/bob').set({ barred: ['xp'] });
    expect(
      await rankProgress(moderation(), 'bob', progress(900), NOW, NOW)
    ).toEqual({ skipped: 'barred' });
    expect(
      await rankProgress(moderation(), 'cy', { json: '{' }, NOW, NOW)
    ).toEqual({ skipped: 'unparsable' });
  });
});

describe('the online board', () => {
  const ROOM_AT = NOW - 10 * 60_000;

  async function agreed(
    id: string,
    extra: Partial<ReplayDoc> = {},
    reportAt = NOW
  ): Promise<ReplayDoc> {
    const doc = {
      players: ['host', 'guest'],
      kind: 'online',
      levelId: 'quarantine',
      difficulty: 'normal',
      balanceVersion: engine.BALANCE_VERSION,
      replayVersion: 2,
      createdAt: Timestamp.fromMillis(NOW),
      ticks: 2_400,
      endedBy: 'annihilation',
      winnerSeat: 0,
      hint: 50,
      state: 'agreed',
      optOut: [],
      bound: true,
      room: {
        code: 'ABCDEF',
        n: 1,
        host: 'host',
        guest: 'guest',
        createdAt: Timestamp.fromMillis(ROOM_AT),
      },
      ...extra,
    } as ReplayDoc;
    await db.doc(`replays/${id}`).set(doc);
    for (const uid of doc.players) {
      await db
        .doc(`replays/${id}/reports/${uid}`)
        .set({ at: Timestamp.fromMillis(reportAt) });
    }
    return doc;
  }

  it('counts a win and a loss once, in one transaction with the caps', async () => {
    const doc = await agreed('o_1');
    expect(await countOnline(db, engine, accounts, 'o_1', doc, NOW)).toEqual({
      counted: { winner: true, loser: true, draw: false },
    });
    expect(await countOnline(db, engine, accounts, 'o_1', doc, NOW)).toEqual({
      done: true,
    });
    expect((await entry('host', 'online', 'online'))?.show).toEqual({
      w: 1,
      l: 0,
      d: 0,
      nr: 0,
    });
    expect((await entry('guest', 'online', 'online'))?.sort).toBe(
      engine.onlineSort(0, 1)
    );
    expect((await db.doc('replays/o_1').get()).get('rankedAt')).toBeDefined();
  });

  it('counts nothing for short, unbound, desynced or too fast matches', async () => {
    const cases: [Partial<ReplayDoc>, string][] = [
      [{ ticks: 600 }, 'short'],
      [{ bound: false }, 'unbound'],
      [{ endedBy: 'desync' }, 'desync'],
    ];
    for (const [index, [extra, reason]] of cases.entries()) {
      const doc = await agreed(`o_${index}`, extra);
      expect(
        await countOnline(db, engine, accounts, `o_${index}`, doc, NOW)
      ).toEqual({ reason });
      expect(
        (await db.doc(`replays/o_${index}`).get()).get('rankedReason')
      ).toBe(reason);
    }
    // Ten minutes of room cannot hold a match of an hour.
    const long = await agreed('o_long', { ticks: 60 * 60 * 60 });
    expect(
      await countOnline(db, engine, accounts, 'o_long', long, NOW)
    ).toEqual({ reason: 'too-fast' });
  });

  it('keeps to 3 results per pair a day, and counts no match with a banned player', async () => {
    for (let n = 1; n <= 3; n++) {
      const doc = await agreed(`o_${n}`, { ticks: 1_800 });
      await countOnline(db, engine, accounts, `o_${n}`, doc, NOW);
    }
    const fourth = await agreed('o_4', { ticks: 1_800 });
    expect(await countOnline(db, engine, accounts, 'o_4', fourth, NOW)).toEqual(
      { reason: 'capped' }
    );
    await db.doc('bans/guest').set({
      since: Timestamp.fromMillis(NOW),
      until: null,
      reason: 'cheating',
    });
    const banned = await agreed('o_5', {
      room: {
        code: 'GHJKLM',
        n: 1,
        host: 'host',
        guest: 'guest',
        createdAt: Timestamp.fromMillis(ROOM_AT),
      },
    });
    expect(await countOnline(db, engine, accounts, 'o_5', banned, NOW)).toEqual(
      { reason: 'banned' }
    );
  });

  it('counts at most 5 wins a day against accounts younger than 3 days', async () => {
    extraAccounts['guest'] = { createdAt: NOW - DAY };
    await db.doc('boardMembers/host').set({
      online: { day: TODAY, wins: 0, newOpponentWins: 5 },
    });
    const doc = await agreed('o_1');
    expect(await countOnline(db, engine, accounts, 'o_1', doc, NOW)).toEqual({
      counted: { winner: false, loser: true, draw: false },
    });
  });

  it('closes a match only one player reported as "Not reported" for the other', async () => {
    const doc = await agreed('o_w', {
      players: ['host'],
      state: 'waiting',
      createdAt: Timestamp.fromMillis(NOW - 3 * HOUR),
      closeAt: Timestamp.fromMillis(NOW - HOUR),
    });
    await agreed('o_c'); // gives guest an online entry
    await countOnline(
      db,
      engine,
      accounts,
      'o_c',
      (await db.doc('replays/o_c').get()).data() as ReplayDoc,
      NOW
    );
    expect(await closeWaitingOnline(moderation(), NOW)).toBe(1);
    expect(await closeWaitingOnline(moderation(), NOW)).toBe(0);
    expect((await entry('guest', 'online', 'online'))?.show).toEqual({
      w: 0,
      l: 1,
      d: 0,
      nr: 1,
    });
    expect(doc.players).toEqual(['host']);
  });

  it('does not find a closed match again, so closed ones never fill a run', async () => {
    for (const [id, back] of [
      ['o_w1', 2],
      ['o_w2', 1],
    ] as const) {
      await agreed(id, {
        players: ['host'],
        state: 'waiting',
        createdAt: Timestamp.fromMillis(NOW - 2 * HOUR - back * HOUR),
        closeAt: Timestamp.fromMillis(NOW - back * HOUR),
      });
    }
    expect(await closeWaitingOnline(moderation(), NOW, 1)).toBe(1);
    expect(await closeWaitingOnline(moderation(), NOW, 1)).toBe(1);
    expect(await closeWaitingOnline(moderation(), NOW, 1)).toBe(0);
    const closed = await db.doc('replays/o_w1').get();
    expect(closed.get('state')).toBe('waiting');
    expect(closed.get('closeAt')).toBeUndefined();
    expect((await member('guest')).record?.nr).toBe(2);
  });
});

describe('ranked daily and endless matches', () => {
  async function declare(uid: string, id: string, at: number): Promise<void> {
    await db.doc(`players/${uid}/attempts/${id}`).set({
      at: Timestamp.fromMillis(at),
      expireAt: Timestamp.fromMillis(at + 31 * DAY),
    });
  }

  async function ranked(
    uid: string,
    id: string,
    at: number,
    levelId: string,
    won = false,
    seed = engine.attemptSeed(uid, id, at)
  ): Promise<Replay> {
    const replay = await rankedReplay(engine.rankedPlan(levelId, seed), 120, {
      attempt: { id, at },
    });
    return won
      ? {
          ...replay,
          header: {
            ...replay.header,
            outcome: { endedBy: 'forfeit', winnerSeat: 0 },
          },
        }
      : replay;
  }

  /** Submits a ranked replay as the client does, and ranks it. */
  async function submit(
    uid: string,
    submissionId: string,
    replay: Replay,
    attempt: string,
    arrivedAt = NOW
  ): Promise<ReplayDoc> {
    const result = await acceptSubmission(
      db,
      submissionId,
      {
        uid,
        bytes: Buffer.from(await bytesOf(replay)),
        hint: 50,
        createdAt: Timestamp.fromMillis(arrivedAt),
        expireAt: Timestamp.fromMillis(arrivedAt + DAY),
        attempt,
      },
      arrivedAt
    );
    expect(result).toEqual(
      expect.objectContaining({ stored: `l_${submissionId}` })
    );
    const doc = (
      await db.doc(`replays/l_${submissionId}`).get()
    ).data() as ReplayDoc;
    await rankReplay(
      db,
      engine,
      accounts,
      `l_${submissionId}`,
      undefined,
      doc,
      arrivedAt
    );
    return (
      await db.doc(`replays/l_${submissionId}`).get()
    ).data() as ReplayDoc;
  }

  describe('daily', () => {
    const level = () => engine.dailyLevelId(TODAY);
    const first = `d_${TODAY}_1`;
    const second = `d_${TODAY}_2`;

    it('takes a checked attempt in as provisional, then verifies it', async () => {
      const at = NOW - 60_000;
      await declare('ana', first, at);
      const stored = await submit(
        'ana',
        's1',
        await ranked('ana', first, at, level()),
        first
      );
      // A plain match on the ranked ruleset (ADR 0015): replay version 5.
      expect(stored.replayVersion).toBe(engine.GPU_INT_REPLAY_VERSION);
      expect(stored.rankedReason).toBeUndefined();
      expect(stored.rankedAt).toBeDefined();
      const boardId = `daily-${TODAY}`;
      expect(await entry('ana', boardId, 'daily')).toEqual(
        expect.objectContaining({
          status: 'provisional',
          sort: engine.dailySort(false, 120),
          show: { ticks: 120, won: false },
          name: null,
        })
      );
      expect((await member('ana')).boards).toEqual([boardId]);

      expect(
        await verifyDaily(db, engine, 'ana', TODAY, fixedPool('daily'), NOW)
      ).toBe('verified');
      expect((await entry('ana', boardId, 'daily'))?.status).toBe('verified');
      expect((await member('ana')).verifiedBefore).toBe(true);
      // ADR 0016: the re-run's medallion goes into the level statistics.
      const stats = (
        await db
          .doc(
            `levelStats/${levelStatsId({ levelId: level(), difficulty: 'normal' }, 'daily')}`
          )
          .get()
      ).data();
      expect(stats).toEqual(
        expect.objectContaining({
          attempts: 1,
          rerun: 1,
          durations: { lt1m: 1 },
        })
      );
      expect(stats?.['medals']).toBeUndefined();
      expect(stats?.['evolved']).toBeUndefined();
      expect(
        await verifyDaily(db, engine, 'ana', TODAY, fixedPool('daily'), NOW)
      ).toBe('nothing');
    });

    it('charges the slice only for a re-run it reserved', async () => {
      const at = NOW - 60_000;
      await declare('ana', first, at);
      await submit('ana', 's1', await ranked('ana', first, at, level()), first);
      await db.doc('replays/l_s1/blob/data').delete();
      const slice = new Slice({ daily: 200, endless: 0 }, NOW + HOUR);
      expect(
        await verifyDaily(db, engine, 'ana', TODAY, slice.payer('daily'), NOW)
      ).toBe('nothing');
      // Nothing spent: a second re-run of 100 ticks still fits the 200.
      slice.spend('daily', 100);
      expect(slice.poolFor('daily', 100)).toBe('daily');
    });

    it("refuses a seed, setup or level that is not the declaration's, and late uploads", async () => {
      const at = NOW - 60_000;
      await declare('ana', first, at);
      const wrongSeed = await submit(
        'ana',
        's1',
        await ranked('ana', first, at, level(), false, 42),
        first
      );
      expect(wrongSeed.rankedReason).toBe('seed-mismatch');
      await declare('ana', second, at);
      const late = await submit(
        'ana',
        's2',
        await ranked('ana', second, at, level()),
        second,
        at + 10 * 60_000
      );
      expect(late.rankedReason).toBe('late');
      expect(await db.doc(`dailyRuns/${TODAY}_ana`).get()).toEqual(
        expect.objectContaining({ exists: false })
      );
    });

    it('takes only the first replay of an attempt, and falls back after a failed check', async () => {
      const at = NOW - 60_000;
      await declare('ana', first, at);
      await declare('ana', second, at);
      const lost = await ranked('ana', first, at, level());
      await submit('ana', 's1', lost, first);
      const again = await submit('ana', 's2', lost, first);
      expect(again.rankedReason).toBe('used');
      const won = await submit(
        'ana',
        's3',
        await ranked('ana', second, at, level(), true),
        second
      );
      const boardId = `daily-${TODAY}`;
      expect((await entry('ana', boardId, 'daily'))?.show).toEqual({
        ticks: 120,
        won: true,
      });
      // The win's re-run fails: the entry falls back to the loss.
      await db.doc(`replays/l_s3`).update({ state: 'unverified' });
      await rankReplay(db, engine, accounts, 'l_s3', won, {
        ...won,
        state: 'unverified',
      });
      expect((await entry('ana', boardId, 'daily'))?.show).toEqual({
        ticks: 120,
        won: false,
      });
      expect((await db.doc('moderation/ana').get()).get('failedChecks')).toBe(
        1
      );
    });

    it('orders candidates by trust, and skips an account that failed twice in a week', async () => {
      extraAccounts['trusted'] = {
        anonymous: false,
        createdAt: NOW - 30 * DAY,
      };
      extraAccounts['fresh'] = { createdAt: NOW - HOUR };
      for (const uid of ['fresh', 'trusted', 'flaky']) {
        const at = NOW - 60_000;
        await declare(uid, first, at);
        await submit(
          uid,
          `s_${uid}`,
          await ranked(uid, first, at, level(), uid === 'fresh'),
          first
        );
      }
      await recordFailure(db, 'flaky', NOW - DAY);
      await recordFailure(db, 'flaky', NOW);
      const candidates = await candidatesOf(
        db,
        engine,
        accounts,
        `daily-${TODAY}`,
        NOW
      );
      expect(candidates.map((candidate) => candidate.uid)).toEqual([
        'trusted',
        'fresh',
      ]);
    });
  });

  describe('endless', () => {
    const runId = `${TODAY.replaceAll('-', '')}1`;
    const attempt = (index: number) => `e_${runId}_${index}`;

    it('builds the run from its declared matches, verifies it in order, and ranks the best run', async () => {
      const at0 = NOW - 60_000;
      await declare('ana', attempt(0), at0);
      const runSeed = engine.attemptSeed('ana', attempt(0), at0);
      await submit(
        'ana',
        's0',
        await ranked('ana', attempt(0), at0, runLevel(runSeed, 0), true),
        attempt(0)
      );
      // Match 1 was declared three hours ago and never uploaded: a lost life.
      await declare('ana', attempt(1), NOW - 3 * HOUR);
      const at2 = NOW - 30_000;
      await declare('ana', attempt(2), at2);
      await submit(
        'ana',
        's2',
        await ranked('ana', attempt(2), at2, runLevel(runSeed, 1), true),
        attempt(2)
      );
      const run = (await db.doc(`endlessRuns/ana_${runId}`).get()).data();
      expect(run).toEqual(
        expect.objectContaining({
          depth: 2,
          seconds: 4,
          status: 'provisional',
          best: true,
        })
      );
      expect(run?.['matches'].map((m: { state: string }) => m.state)).toEqual([
        'won',
        'lost',
        'won',
      ]);
      expect((await entry('ana', 'endless', 'endless'))?.show).toEqual({
        depth: 2,
        seconds: 4,
      });

      expect(
        await verifyRun(db, engine, 'ana', fixedPool('endless'), Infinity, NOW)
      ).toBe('verified');
      expect((await entry('ana', 'endless', 'endless'))?.status).toBe(
        'verified'
      );

      // rankReplay sees the re-run's state change too: a no-op that writes
      // nothing, so no rebuildTop follows.
      const runRef = db.doc(`endlessRuns/ana_${runId}`);
      const entryRef = db.doc(
        `boards/endless/entries/${(await member('ana')).entryIds.endless}`
      );
      const written = async () =>
        (await db.getAll(runRef, entryRef)).map((doc) =>
          doc.updateTime?.toMillis()
        );
      const before = await written();
      const verified = (await db.doc('replays/l_s0').get()).data() as ReplayDoc;
      expect(await applyRerun(db, engine, 'l_s0', verified, NOW)).toBe(false);
      expect(await written()).toEqual(before);
    });

    /** A run of two won matches, ranked as the client sends them. */
    async function twoWins(): Promise<void> {
      const at0 = NOW - 60_000;
      const at1 = NOW - 30_000;
      await declare('ana', attempt(0), at0);
      await declare('ana', attempt(1), at1);
      const runSeed = engine.attemptSeed('ana', attempt(0), at0);
      for (const [i, at] of [at0, at1].entries()) {
        await submit(
          'ana',
          `s${i}`,
          await ranked('ana', attempt(i), at, runLevel(runSeed, i), true),
          attempt(i)
        );
      }
    }

    it('verifies a run whose first attempt expired, from what the run kept', async () => {
      await twoWins();
      await db.doc(`players/ana/attempts/${attempt(0)}`).delete();
      expect(
        await verifyRun(db, engine, 'ana', fixedPool('endless'), Infinity, NOW)
      ).toBe('verified');
      const run = (await db.doc(`endlessRuns/ana_${runId}`).get()).data();
      expect(run).toEqual(
        expect.objectContaining({ depth: 2, status: 'verified' })
      );
      expect((await entry('ana', 'endless', 'endless'))?.status).toBe(
        'verified'
      );
    });

    it('turns a run stale once a win expired before its re-run', async () => {
      await twoWins();
      await db.doc(`endlessRuns/ana_${runId}`).update({ queued: true });
      await db.doc('replays/l_s0').delete();
      expect(
        await verifyRun(db, engine, 'ana', fixedPool('endless'), Infinity, NOW)
      ).toBe('stale');
      const run = (await db.doc(`endlessRuns/ana_${runId}`).get()).data();
      expect(run).toEqual(
        expect.objectContaining({ depth: 2, status: 'stale' })
      );
      expect(run?.['queued']).toBeUndefined();
      expect((await entry('ana', 'endless', 'endless'))?.status).toBe('stale');
      expect(await candidatesOf(db, engine, accounts, 'endless', NOW)).toEqual(
        []
      );
    });

    it('tells a win too long to re-run from a spent budget, by its ticks', async () => {
      await twoWins();
      // 36,010 ticks: 600 s once rounded, 10 ticks over the re-run limit.
      const ticks = engine.MAX_RERUN_TICKS + 10;
      const ref = db.doc(`endlessRuns/ana_${runId}`);
      const matches = (await ref.get()).get('matches') as { ticks: number }[];
      matches[0] = { ...matches[0], ticks };
      await ref.update({ matches });
      await db.doc('replays/l_s0').update({ ticks });
      expect(
        await verifyRun(db, engine, 'ana', fixedPool('endless'), Infinity, NOW)
      ).toBe('too-long');
    });

    it('takes a level that does not follow from the run as a lost life', async () => {
      const at0 = NOW - 60_000;
      await declare('ana', attempt(0), at0);
      const stored = await submit(
        'ana',
        's0',
        await ranked('ana', attempt(0), at0, runLevel(1, 5), true),
        attempt(0)
      );
      expect(stored.rankedReason).toBe('level-mismatch');
      expect(await entry('ana', 'endless', 'endless')).toBeUndefined();
    });

    it('takes a late replay as a lost life that keeps its reason', async () => {
      const at0 = NOW - 60_000;
      await declare('ana', attempt(0), at0);
      const runSeed = engine.attemptSeed('ana', attempt(0), at0);
      const late = await submit(
        'ana',
        's0',
        await ranked('ana', attempt(0), at0, runLevel(runSeed, 0), true),
        attempt(0),
        at0 + 10 * 60_000
      );
      expect(late.rankedReason).toBe('late');
      expect(late.rankedAt).toBeUndefined();
      const run = (await db.doc(`endlessRuns/ana_${runId}`).get()).data();
      expect(run?.['matches'][0].state).toBe('lost');
      expect(run?.['depth']).toBe(0);
    });

    it('closes an open match as a lost life once two hours passed', async () => {
      const at0 = NOW - 60_000;
      await declare('ana', attempt(0), at0);
      const runSeed = engine.attemptSeed('ana', attempt(0), at0);
      await submit(
        'ana',
        's0',
        await ranked('ana', attempt(0), at0, runLevel(runSeed, 0), true),
        attempt(0)
      );
      await declare('ana', attempt(1), NOW);
      // Recompute now, with match 1 open.
      await closeAttempts(moderation(), NOW);
      await db.doc(`endlessRuns/ana_${runId}`).update({
        nextCloseAt: Timestamp.fromMillis(NOW),
      });
      expect(await closeAttempts(moderation(), NOW + 3 * HOUR)).toBe(1);
      const run = (await db.doc(`endlessRuns/ana_${runId}`).get()).data();
      expect(run?.['matches'][1].state).toBe('lost');
      expect(run?.['nextCloseAt']).toBeNull();
    });

    it('keeps a closed match closed when its attempt is declared again', async () => {
      const at0 = NOW - 60_000;
      await declare('ana', attempt(0), at0);
      const runSeed = engine.attemptSeed('ana', attempt(0), at0);
      await submit(
        'ana',
        's0',
        await ranked('ana', attempt(0), at0, runLevel(runSeed, 0), true),
        attempt(0)
      );
      await declare('ana', attempt(1), NOW - 3 * HOUR);
      await updateEndlessRun(db, engine, 'ana', runId, NOW);
      const ref = db.doc(`endlessRuns/ana_${runId}`);
      expect((await ref.get()).get('matches')[1]).toEqual(
        expect.objectContaining({ state: 'lost', at: NOW - 3 * HOUR })
      );
      // The attempt comes back with a new time (its TTL ran out, say): the
      // run keeps the time it knew, and the match stays lost.
      await declare('ana', attempt(1), NOW);
      await updateEndlessRun(db, engine, 'ana', runId, NOW + 1);
      expect((await ref.get()).get('matches')[1]).toEqual(
        expect.objectContaining({ state: 'lost', at: NOW - 3 * HOUR })
      );
      expect((await ref.get()).get('nextCloseAt')).toBeNull();
    });

    it('takes in a stored replay through the retry of a failed rankReplay, before its match closes', async () => {
      const at0 = NOW - 60_000;
      await declare('ana', attempt(0), at0);
      const runSeed = engine.attemptSeed('ana', attempt(0), at0);
      await submit(
        'ana',
        's0',
        await ranked('ana', attempt(0), at0, runLevel(runSeed, 0), true),
        attempt(0)
      );
      const at1 = NOW - 30_000;
      await declare('ana', attempt(1), at1);
      const won = await ranked(
        'ana',
        attempt(1),
        at1,
        runLevel(runSeed, 1),
        true
      );
      await acceptSubmission(
        db,
        's1',
        {
          uid: 'ana',
          bytes: Buffer.from(await bytesOf(won)),
          hint: 50,
          createdAt: Timestamp.fromMillis(NOW),
          expireAt: Timestamp.fromMillis(NOW + DAY),
          attempt: attempt(1),
        },
        NOW
      );
      const stored = (await db.doc('replays/l_s1').get()).data() as ReplayDoc;
      // The first delivery fails half way (here: on reading the seed).
      const failing = {
        ...engine,
        attemptSeed: () => {
          throw new Error('unavailable');
        },
      } as Engine;
      await expect(
        rankReplay(db, failing, accounts, 'l_s1', undefined, stored, NOW)
      ).rejects.toThrow('unavailable');
      // The retry takes it in; a further delivery changes nothing.
      for (const delivery of [1, 2]) {
        expect([
          delivery,
          await rankReplay(
            db,
            engine,
            accounts,
            'l_s1',
            undefined,
            stored,
            NOW
          ),
        ]).toEqual([delivery, 'ranked']);
      }
      await db.doc(`endlessRuns/ana_${runId}`).update({
        nextCloseAt: Timestamp.fromMillis(NOW),
      });
      expect(await closeAttempts(moderation(), NOW + 3 * HOUR)).toBe(1);
      const run = (await db.doc(`endlessRuns/ana_${runId}`).get()).data();
      expect(run?.['matches'].map((m: { state: string }) => m.state)).toEqual([
        'won',
        'won',
      ]);
      expect(run?.['depth']).toBe(2);
      const replay = (await db.doc('replays/l_s1').get()).data();
      expect(replay?.['rankedAt']).toBeDefined();
      expect(replay?.['rankedReason']).toBeUndefined();
    });
  });
});

describe('rebuildTop', () => {
  async function put(boardId: string, id: string, extra: Partial<EntryDoc>) {
    const doc = {
      sort: 1,
      atHour: 0,
      status: 'counted',
      baseStatus: 'counted',
      name: null,
      tag: 1000,
      avatar: 0,
      show: { xp: 1, rank: 'spore' },
      updatedAt: Timestamp.fromMillis(NOW),
      ...extra,
    } as EntryDoc;
    await db.doc(`boards/${boardId}/entries/${id}`).set(doc);
    return doc;
  }

  it('writes the visible rows with shared positions, and skips what cannot change it', async () => {
    await put('xp', 'a', { sort: 30 });
    await put('xp', 'b', { sort: 20 });
    await put('xp', 'c', { sort: 20 });
    await put('xp', 'h', { sort: 99, status: 'hidden' });
    expect(await rebuildTop(db, engine, 'xp', 'a', undefined, NOW)).toBe(true);
    const top = (await db.doc('boards/xp').get()).data();
    expect(
      top?.['rows'].map((row: { entryId: string; pos: number }) => [
        row.entryId,
        row.pos,
      ])
    ).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 2],
    ]);
    expect(top?.['cut']).toBe(0);
  });

  it('adds the verified rank inside the cut, and keeps final', async () => {
    const boardId = `daily-${TODAY}`;
    await put(boardId, 'p', { sort: 50, status: 'provisional' });
    await put(boardId, 'v', { sort: 40, status: 'verified' });
    await db.doc(`boards/${boardId}`).set({ final: true });
    await rebuildTop(db, engine, boardId, 'v', undefined, NOW);
    const top = (await db.doc(`boards/${boardId}`).get()).data();
    expect(top?.['final']).toBe(true);
    expect(top?.['cut']).toBe(10);
    expect(top?.['rows']).toEqual([
      expect.objectContaining({ entryId: 'p', pos: 1 }),
      expect.objectContaining({ entryId: 'v', pos: 2, rank: 1 }),
    ]);
    expect(top?.['rows'][0].rank).toBeUndefined();
    expect(top?.['expireAt']).toBeDefined();
  });

  it('rebuilds nothing while TTL drains a past daily board', async () => {
    const boardId = `daily-${dayOf(NOW - 40 * DAY)}`;
    await put(boardId, 'p', { sort: 50, status: 'provisional' });
    expect(await rebuildTop(db, engine, boardId, 'gone', undefined, NOW)).toBe(
      false
    );
    expect((await db.doc(`boards/${boardId}`).get()).exists).toBe(false);
  });
});

describe('who appears under which name', () => {
  it('re-labels every board when the name or the opt-outs change', async () => {
    await db.doc('profiles/ana').set({
      name: 'Ana',
      motto: '',
      avatar: { kind: 'preset', id: 4 },
      shareStatus: true,
      publicName: true,
    });
    await rankProgress(moderation(), 'ana', progress(500), NOW, NOW);
    expect(await entry('ana', 'xp', 'xp')).toEqual(
      expect.objectContaining({ name: 'Ana', avatar: 4 })
    );
    const before = (await db.doc('profiles/ana').get()).data();
    const after = { ...before, boardOptOut: true };
    await db.doc('profiles/ana').set(after);
    expect(
      await boardProfileChanged(db, engine, 'ana', before, after, NOW)
    ).toBe(1);
    expect(await entry('ana', 'xp', 'xp')).toEqual(
      expect.objectContaining({ status: 'hidden', name: null })
    );
    expect((await member('ana')).hiddenBy).toEqual({ xp: 'optout' });
    await db.doc('profiles/ana').set(before ?? {});
    await boardProfileChanged(db, engine, 'ana', after, before, NOW);
    expect((await entry('ana', 'xp', 'xp'))?.status).toBe('counted');
  });
});

describe('adminCommand', () => {
  let n = 0;
  async function command(
    type: string,
    target: Record<string, string> = {},
    args: Record<string, unknown> = {},
    by = 'owner'
  ) {
    const id = `c${++n}`;
    const data = {
      uid: by,
      type,
      // Statistics act on nothing: `parseAdminCommand` wants a null target.
      target: type.startsWith('stats') ? null : target,
      args,
      reason: type.startsWith('stats') ? '' : 'a reason',
      createdAt: Timestamp.fromMillis(NOW),
      expireAt: Timestamp.fromMillis(NOW + DAY),
    };
    await db.doc(`adminCommands/${id}`).set(data);
    const result = await runAdminCommand(
      adminDeps(['a', 'b']),
      id,
      data,
      by,
      NOW
    );
    return { id, result };
  }

  it('refuses anyone but the owner, and a command it cannot read', async () => {
    expect((await command('stats.refresh', {}, {}, 'mallory')).result).toEqual(
      expect.objectContaining({ ok: false, error: 'not-admin' })
    );
    const data = {
      uid: 'owner',
      type: 'stats.refresh',
      target: null,
      args: {},
    };
    await db.doc('adminCommands/x').set(data);
    expect(
      await runAdminCommand(adminDeps(), 'x', data, 'someone-else', NOW)
    ).toEqual(expect.objectContaining({ ok: false, error: 'not-writer' }));
    const odd = { uid: 'owner', type: 'player.delete' };
    await db.doc('adminCommands/y').set(odd);
    expect(await runAdminCommand(adminDeps(), 'y', odd, 'owner', NOW)).toEqual(
      expect.objectContaining({ ok: false, error: 'invalid' })
    );
    expect((await db.doc('adminAudit/x').get()).exists).toBe(false);
  });

  it('resets a profile, notifies the player and audits what it replaced', async () => {
    await db.doc('profiles/ana').set({
      name: 'Rude',
      motto: 'rude',
      avatar: { kind: 'image', data: 'data:image/png;base64,AAAA' },
      shareStatus: false,
      publicName: true,
    });
    const { id, result } = await command('profile.reset', { uid: 'ana' });
    expect(result.ok).toBe(true);
    const profile = (await db.doc('profiles/ana').get()).data();
    const fresh = engine.defaultProfile('ana');
    expect(profile).toEqual(
      expect.objectContaining({
        name: fresh.name,
        motto: '',
        avatar: fresh.avatar,
        shareStatus: false,
      })
    );
    const audit = (await db.doc(`adminAudit/${id}`).get()).data();
    expect(audit).toEqual(
      expect.objectContaining({
        by: 'owner',
        type: 'profile.reset',
        source: 'adminCommand',
        ok: true,
        before: expect.objectContaining({
          name: 'Rude',
          avatarKind: 'image',
          imageSize: 26,
        }),
      })
    );
    expect(JSON.stringify(audit)).not.toContain('base64');
    expect(
      (await db.collection('players/ana/notices').get()).docs.map((doc) =>
        doc.get('type')
      )
    ).toEqual(['profile-reset']);
    expect((await db.doc('moderation/ana').get()).get('resets')).toBe(1);
    expect((await db.doc(`adminCommands/${id}`).get()).get('result')).toEqual(
      expect.objectContaining({ ok: true })
    );
    // Run again: done, nothing twice.
    const again = await runAdminCommand(
      adminDeps(),
      id,
      (await db.doc(`adminCommands/${id}`).get()).data(),
      'owner',
      NOW
    );
    expect(again.error).toBe('done');
  });

  it('hides and bars an entry by its id, and restores it', async () => {
    await rankProgress(moderation(), 'ana', progress(500), NOW, NOW);
    const entryId = (await member('ana')).entryIds.xp;
    const hidden = await command(
      'board.hideEntry',
      { boardId: 'xp', entryId },
      { bar: true }
    );
    expect(hidden.result.ok).toBe(true);
    expect((await entry('ana', 'xp', 'xp'))?.status).toBe('hidden');
    expect((await member('ana')).barred).toEqual(['xp']);
    expect(
      await rankProgress(moderation(), 'ana', progress(900), NOW, NOW + 1)
    ).toEqual({ skipped: 'barred' });
    expect((await command('board.restore', { uid: 'ana' })).result.ok).toBe(
      true
    );
    expect((await entry('ana', 'xp', 'xp'))?.status).toBe('counted');
    expect((await member('ana')).barred).toEqual([]);
    // Hiding the player by one of their entries hides them everywhere.
    const daily = `daily-${TODAY}`;
    await db.doc('boardMembers/ana').update({ boards: ['xp', daily] });
    expect(
      (await command('board.hidePlayer', { boardId: 'xp', entryId })).result.ok
    ).toBe(true);
    expect((await member('ana')).hiddenBy).toEqual({
      xp: 'admin',
      [daily]: 'admin',
    });
  });

  it('bans a player out of everything others see, and unbans them', async () => {
    extraAccounts['ana'] = { anonymous: false, googleUid: 'g-ana' };
    await rankProgress(moderation(), 'ana', progress(500), NOW, NOW);
    await db.doc('queue/ana').set({ since: Timestamp.fromMillis(NOW) });
    await db.doc('rooms/ABCDEF').set({ host: 'ana' });
    await db.doc('invites/abc').set({ from: 'ana' });
    await db
      .doc('players/bob/requests/ana')
      .set({ at: Timestamp.fromMillis(NOW) });
    await db
      .doc('players/bob/requests/cy')
      .set({ at: Timestamp.fromMillis(NOW) });
    await db.doc('players/bob/challenges/ana').set({ code: 'ABCDEF' });
    await presence.set('status/ana', { state: 'online', at: 1 });
    await presence.set('connections/ana', { state: 'online', at: 1 });
    await db.doc('publicReplays/p1').set({
      replayId: 'l_x',
      uids: ['ana'],
      removedAt: null,
    });

    const until = NOW + 7 * DAY;
    const banned = await command(
      'player.ban',
      { uid: 'ana' },
      { until, reason: 'cheating' }
    );
    expect(banned.result.ok).toBe(true);
    const ban = (await db.doc('bans/ana').get()).data();
    expect(ban?.['until'].toMillis()).toBe(until);
    expect(ban).not.toHaveProperty('by');
    expect(presence.values.get('bans/ana')).toBe(until);
    expect(presence.values.has('status/ana')).toBe(false);
    expect(presence.values.has('connections/ana')).toBe(false);
    for (const path of [
      'queue/ana',
      'rooms/ABCDEF',
      'invites/abc',
      'players/bob/requests/ana',
      'players/bob/challenges/ana',
    ]) {
      expect([path, (await db.doc(path).get()).exists]).toEqual([path, false]);
    }
    expect((await db.doc('players/bob/requests/cy').get()).exists).toBe(true);
    expect(
      (await db.doc('publicReplays/p1').get()).get('removedAt')
    ).not.toBeNull();
    expect((await entry('ana', 'xp', 'xp'))?.status).toBe('hidden');
    expect((await member('ana')).hiddenBy).toEqual({ xp: 'ban' });
    expect(
      (await db.doc(`banTombstones/${KEY.idOf('g-ana')}`).get()).get('reason')
    ).toBe('cheating');

    // Banning again changes only the end and the reason.
    const longer = await command(
      'player.ban',
      { uid: 'ana' },
      { until: null, reason: 'spam' }
    );
    expect(longer.result.ok).toBe(true);
    expect((await db.doc('bans/ana').get()).get('until')).toBeNull();
    expect((await db.doc('moderation/ana').get()).get('bans')).toBe(1);

    expect((await command('player.unban', { uid: 'ana' })).result.ok).toBe(
      true
    );
    expect((await db.doc('bans/ana').get()).exists).toBe(false);
    expect(presence.values.has('bans/ana')).toBe(false);
    expect(
      (await db.doc(`banTombstones/${KEY.idOf('g-ana')}`).get()).exists
    ).toBe(false);
    expect((await entry('ana', 'xp', 'xp'))?.status).toBe('counted');
    const notices = (await db.collection('players/ana/notices').get()).docs
      .map((doc) => doc.get('type') as string)
      .sort((a, b) => a.localeCompare(b));
    expect(notices).toEqual(['banned', 'unbanned']);
  });

  it('refreshes and recounts the statistics', async () => {
    await presence.set('connections/a', { state: 'online', at: 1 });
    await presence.set('connections/b', { state: 'playing', at: 1 });
    expect((await command('stats.recount')).result.ok).toBe(true);
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(2);
    expect((await command('stats.refresh')).result.ok).toBe(true);
    const stats = (await db.doc('adminStats/now').get()).data();
    expect(stats).toEqual(
      expect.objectContaining({ accounts: 2, online: 2, playing: 1 })
    );
  });

  it('verifies a daily entry now from the admin budget', async () => {
    const id = `d_${TODAY}_1`;
    const at = NOW - 60_000;
    await db.doc(`players/ana/attempts/${id}`).set({
      at: Timestamp.fromMillis(at),
      expireAt: Timestamp.fromMillis(NOW + DAY),
    });
    const replay = await rankedReplay(
      engine.rankedPlan(
        engine.dailyLevelId(TODAY),
        engine.attemptSeed('ana', id, at)
      ),
      120,
      { attempt: { id, at } }
    );
    await acceptSubmission(
      db,
      's1',
      {
        uid: 'ana',
        bytes: Buffer.from(await bytesOf(replay)),
        hint: 50,
        createdAt: Timestamp.fromMillis(NOW),
        expireAt: Timestamp.fromMillis(NOW + DAY),
        attempt: id,
      },
      NOW
    );
    const doc = (await db.doc('replays/l_s1').get()).data() as ReplayDoc;
    await rankReplay(db, engine, accounts, 'l_s1', undefined, doc, NOW);
    const entryId = (await member('ana')).entryIds.daily;
    const verified = await command('board.verify', {
      boardId: `daily-${TODAY}`,
      entryId,
    });
    expect(verified.result).toEqual(expect.objectContaining({ ok: true }));
    expect((await entry('ana', `daily-${TODAY}`, 'daily'))?.status).toBe(
      'verified'
    );
    expect(
      (await db.doc(`counters/${TODAY}`).get()).get('verifyTicks.admin')
    ).toBe(120 * GPU_INT_COST);
  });
});

describe('accounts and tombstones', () => {
  it('counts a new account, and re-applies a ban that outlived a Google account', async () => {
    await countAccount(
      moderation(),
      {
        uid: 'guest1',
        anonymous: true,
        createdAt: NOW,
        admin: false,
        googleUid: null,
      },
      NOW
    );
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(1);
    expect((await member('guest1')).accountCreatedAt?.toMillis()).toBe(NOW);

    // A banned Google account is deleted: its tombstone stays.
    extraAccounts['old'] = { anonymous: false, googleUid: 'g-1' };
    await banPlayer(moderation(), 'old', null, 'cheating', NOW);
    forgetBans();
    const deleted = await deletePlayerBoards(
      moderation(),
      {
        uid: 'old',
        anonymous: false,
        createdAt: NOW - DAY,
        admin: false,
        googleUid: 'g-1',
      },
      NOW
    );
    expect(deleted.tombstone).toBe(true);
    expect((await db.doc('bans/old').get()).exists).toBe(false);
    expect((await db.doc('stats/accounts').get()).get('total')).toBe(0);

    // The same Google identity signs up again.
    const result = await countAccount(
      moderation(),
      {
        uid: 'new',
        anonymous: false,
        createdAt: NOW,
        admin: false,
        googleUid: 'g-1',
      },
      NOW
    );
    expect(result.banned).toBe(true);
    expect((await db.doc('bans/new').get()).get('reason')).toBe('cheating');
    const audit = await db
      .collection('adminAudit')
      .where('target.uid', '==', 'new')
      .get();
    expect(audit.docs[0].data()).toEqual(
      expect.objectContaining({ by: 'system', source: 'system' })
    );
  });

  it('checks the tombstone once after a guest links Google', async () => {
    await db.doc(`banTombstones/${KEY.idOf('g-2')}`).set({
      until: null,
      reason: 'spam',
      expireAt: Timestamp.fromMillis(NOW + DAY),
    });
    expect(await checkGoogleLink(moderation(), 'guest', NOW)).toBe(false);
    extraAccounts['guest'] = { anonymous: false, googleUid: 'g-2' };
    // A guest is looked up again only after ten minutes.
    expect(await checkGoogleLink(moderation(), 'guest', NOW + 1)).toBe(false);
    expect(
      await checkGoogleLink(moderation(), 'guest', NOW + 11 * 60_000)
    ).toBe(true);
    expect((await member('guest')).googleChecked).toBe(true);
    // Checked for good: the instance never reads the player's member again.
    await db.doc('boardMembers/guest').delete();
    expect(
      await checkGoogleLink(moderation(), 'guest', NOW + 22 * 60_000)
    ).toBe(false);
    expect((await db.doc('boardMembers/guest').get()).exists).toBe(false);
    expect(
      await applyTombstone(
        moderation(),
        { uid: 'x', anonymous: true, createdAt: NOW, admin: false },
        NOW
      )
    ).toBe(false);
  });

  it('erases a deleted player from the boards and scrubs the audit', async () => {
    await rankProgress(moderation(), 'ana', progress(500), NOW, NOW);
    const entryId = (await member('ana')).entryIds.xp;
    await db.doc('players/ana/notices/n1').set({ type: 'banned' });
    await db.doc('players/ana/attempts/a1').set({ at: Timestamp.now() });
    await db.doc(`dailyRuns/${TODAY}_ana`).set({ uid: 'ana' });
    await db.doc('endlessRuns/ana_1').set({ uid: 'ana' });
    await db.doc('adminAudit/c1').set({
      target: { uid: 'ana' },
      before: { name: 'Rude' },
      after: { name: 'Player 1' },
      type: 'profile.reset',
    });
    const result = await deletePlayerBoards(
      moderation(),
      { uid: 'ana', anonymous: true, createdAt: NOW, admin: false },
      NOW
    );
    expect(result).toEqual({ entries: 1, tombstone: false, scrubbed: 1 });
    for (const path of [
      `boards/xp/entries/${entryId}`,
      'boardMembers/ana',
      'players/ana/notices/n1',
      'players/ana/attempts/a1',
      `dailyRuns/${TODAY}_ana`,
      'endlessRuns/ana_1',
    ]) {
      expect([path, (await db.doc(path).get()).exists]).toEqual([path, false]);
    }
    expect((await db.doc('adminAudit/c1').get()).data()).toEqual(
      expect.objectContaining({
        type: 'profile.reset',
        before: { scrubbed: true },
        after: { scrubbed: true },
      })
    );
  });
});

describe('hourly', () => {
  it('cleans up ended bans with a system audit entry', async () => {
    await banPlayer(moderation(), 'ana', NOW + HOUR, 'spam', NOW);
    expect(await expireBans(moderation(), NOW)).toBe(0);
    expect(await expireBans(moderation(), NOW + 2 * HOUR)).toBe(1);
    expect((await db.doc('bans/ana').get()).exists).toBe(false);
    const audit = await db
      .collection('adminAudit')
      .where('type', '==', 'player.unban')
      .get();
    expect(audit.docs[0].get('source')).toBe('system');
  });

  it('finalises a daily board at 23:00 UTC the next day', async () => {
    const yesterday = dayOf(NOW - DAY);
    await db.doc(`boards/daily-${yesterday}`).set({ rows: [] });
    const finalAt = Date.parse(`${TODAY}T23:00:00Z`);
    expect(await finaliseDailyBoards(moderation(), finalAt - 1)).toEqual([]);
    expect(await finaliseDailyBoards(moderation(), finalAt)).toEqual([
      yesterday,
    ]);
    expect((await db.doc(`boards/daily-${yesterday}`).get()).get('final')).toBe(
      true
    );
  });

  it('runs every step and writes the statistics snapshot', async () => {
    const result = await runHourly(moderation(), Date.now(), NOW);
    expect(result).toEqual(
      expect.objectContaining({ bansEnded: 0, runsClosed: 0, notReported: 0 })
    );
    const hour = new Date(NOW).toISOString().slice(0, 13).replace(/[-T]/g, '');
    expect((await db.doc(`adminStats/h_${hour}`).get()).exists).toBe(true);
    expect(
      (await writeStats(db, engine, presence, NOW)).boards.verifyMinutesCap
    ).toEqual({ gallery: 120, admin: 20, daily: 60, endless: 180 });
  });

  it('unbans by hand too', async () => {
    expect(await unbanPlayer(moderation(), 'nobody', NOW)).toBeNull();
  });
});
