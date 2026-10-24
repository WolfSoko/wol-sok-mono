import { deleteApp, initializeApp } from 'firebase-admin/app';
import { Firestore, getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Account, AccountLookup } from '../accounts';
import {
  DAILY_RANKED_SUBMISSIONS,
  DAILY_SUBMISSIONS,
  forgetBans,
  HOURLY_SUBMISSIONS,
} from '../limits';
import { acceptSubmission, WAITING_CLOSE_MS } from '../replays/accept-replay';
import {
  fixedPool,
  reserveVerification,
  VERIFY_MINUTES,
} from '../replays/budgets';
import { deletePlayerReplays } from '../replays/delete-player-replays';
import { featureBest } from '../replays/feature-best';
import { onProfileChanged } from '../replays/profile-changed';
import { publishReplay, takeDown } from '../replays/publish';
import { runReplayCommand } from '../replays/replay-command';
import { verifyStored } from '../replays/verify';
import { Engine, loadEngine } from '../engine';
import {
  bytesOf,
  ladderComputerPlan,
  ladderPlan,
  onlinePlan,
  recordedReplay,
} from '../testing/replays';
import { dayOf, hourOf } from '../time';

/**
 * The functions' cores against the Firestore emulator: transactions,
 * `create()`, queries and the caps, as the triggers run them. Run by
 * `nx run bacteria-wars-functions:test-integration`.
 */

const PROJECT = 'demo-bacteria-wars';
const NOW = Date.now();
const DAY = 86_400_000;
const app = initializeApp({ projectId: PROJECT }, 'integration');
const db: Firestore = getFirestore(app);

let engine: Engine;
/** The seed of the online plan, which names its replay. */
let onlineSeed: number;

beforeAll(async () => {
  engine = await loadEngine();
  onlineSeed = (await onlinePlan()).seed;
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  forgetBans();
  const host = process.env['FIRESTORE_EMULATOR_HOST'];
  const response = await fetch(
    `http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error(`Could not clear the emulator: ${response.status}`);
  }
});

/** A submission as the client writes it. */
async function submission(
  uid: string,
  bytes: Uint8Array,
  extra: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  return {
    uid,
    bytes: Buffer.from(bytes),
    hint: 80,
    createdAt: Timestamp.fromMillis(NOW),
    expireAt: Timestamp.fromMillis(NOW + DAY),
    ...extra,
  };
}

const local = async () => recordedReplay(await ladderPlan());
const online = async (extra = {}) =>
  recordedReplay(await onlinePlan(), 120, {
    roomCode: 'ABCDEF',
    n: 1,
    ...extra,
  });

async function room(host = 'host', guest = 'guest', expireIn = 3_600_000) {
  await db.doc('rooms/ABCDEF').set({
    host,
    guest,
    createdAt: Timestamp.fromMillis(NOW - 600_000),
    expireAt: Timestamp.fromMillis(NOW + expireIn),
    taken: true,
  });
}

/** Accounts as Auth would answer: linked and a month old, unless said otherwise. */
function accounts(extra: Record<string, Partial<Account>> = {}): AccountLookup {
  return async (uids) =>
    new Map(
      uids.map((uid) => [
        uid,
        {
          uid,
          anonymous: false,
          createdAt: NOW - 30 * DAY,
          admin: false,
          ...extra[uid],
        },
      ])
    );
}

describe('acceptReplay', () => {
  it('stores a local replay for its player, counts its level, and deletes the submission', async () => {
    const data = await submission('ana', await bytesOf(await local()));
    await db.doc('replaySubmissions/s1').set(data);
    expect(await acceptSubmission(db, 's1', data, NOW)).toEqual({
      stored: 'l_s1',
      state: 'submitted',
    });
    const stored = (await db.doc('replays/l_s1').get()).data();
    expect(stored).toEqual(
      expect.objectContaining({
        players: ['ana'],
        kind: 'computer',
        levelId: 'quarantine',
        difficulty: 'hard',
        state: 'submitted',
        hint: 80,
        optOut: [],
        winnerSeat: 1,
        endedBy: 'forfeit',
      })
    );
    expect((stored?.['expireAt'] as Timestamp | undefined)?.toMillis()).toBe(
      NOW + 30 * DAY
    );
    const blob = await db.doc('replays/l_s1/blob/data').get();
    expect(blob.get('size')).toBe((data['bytes'] as Buffer).length);
    // TTL deletes no subcollection: the blob expires with the replay.
    expect((blob.get('expireAt') as Timestamp).toMillis()).toBe(NOW + 30 * DAY);
    expect((await db.doc('replaySubmissions/s1').get()).exists).toBe(false);
    const stats = (await db.doc('levelStats/quarantine_hard').get()).data();
    expect(stats).toEqual(
      expect.objectContaining({ attempts: 1, losses: 1, quits: 1 })
    );
    expect(JSON.stringify(stats)).not.toContain('ana');
  });

  it("stores a match against the ladder's computer (replay version 4)", async () => {
    const replay = await recordedReplay(await ladderComputerPlan());
    const data = await submission('ana', await bytesOf(replay));
    expect(await acceptSubmission(db, 's1', data, NOW)).toEqual({
      stored: 'l_s1',
      state: 'submitted',
    });
    expect((await db.doc('replays/l_s1').get()).data()).toEqual(
      expect.objectContaining({
        kind: 'computer',
        replayVersion: engine.LADDER_REPLAY_VERSION,
      })
    );
    expect((await db.doc('levelStats/quarantine_hard').get()).data()).toEqual(
      expect.objectContaining({ attempts: 1, evolved: 1 })
    );
  });

  it('stores a submission once', async () => {
    const data = await submission('ana', await bytesOf(await local()));
    await acceptSubmission(db, 's1', data, NOW);
    expect(await acceptSubmission(db, 's1', data, NOW)).toEqual({
      dropped: 'duplicate',
    });
    expect(
      (await db.doc('levelStats/quarantine_hard').get()).get('attempts')
    ).toBe(1);
  });

  it('drops the submission of a banned player', async () => {
    await db
      .doc('bans/ana')
      .set({ since: Timestamp.now(), until: null, reason: 'spam' });
    const data = await submission('ana', await bytesOf(await local()));
    await db.doc('replaySubmissions/s1').set(data);
    expect(await acceptSubmission(db, 's1', data, NOW)).toEqual({
      dropped: 'banned',
    });
    expect((await db.doc('replaySubmissions/s1').get()).exists).toBe(false);
  });

  it('keeps to the hourly limit and the daily cap', async () => {
    const data = await submission('ana', await bytesOf(await local()));
    await db
      .doc('limits/ana')
      .set({ hour: hourOf(NOW), count: HOURLY_SUBMISSIONS });
    expect(await acceptSubmission(db, 's1', data, NOW)).toEqual({
      dropped: 'hourly-limit',
    });
    await db.doc('limits/ana').delete();
    await db
      .doc(`counters/${dayOf(NOW)}`)
      .set({ submissions: DAILY_SUBMISSIONS });
    expect(await acceptSubmission(db, 's2', data, NOW)).toEqual({
      dropped: 'daily-cap',
    });
  });

  it('drops what holds no replay to store', async () => {
    expect(
      await acceptSubmission(
        db,
        's1',
        await submission('ana', new Uint8Array([1, 2])),
        NOW
      )
    ).toEqual({ dropped: 'unparsable' });
    expect(await acceptSubmission(db, 's2', { uid: 'ana' }, NOW)).toEqual({
      dropped: 'invalid',
    });
  });

  describe('ranked attempts', () => {
    const attemptId = `d_${dayOf(NOW)}_1`;
    const declaredAt = NOW - 120_000;
    const ranked = () => {
      const plan = engine.rankedPlan(engine.dailyLevelId(dayOf(NOW)), 99);
      return recordedReplay(plan, 120, {
        attempt: { id: attemptId, at: declaredAt + 5 },
      });
    };

    beforeEach(async () => {
      await db.doc(`players/ana/attempts/${attemptId}`).set({
        at: Timestamp.fromMillis(declaredAt),
        expireAt: Timestamp.fromMillis(NOW + 31 * DAY),
      });
    });

    it('copies the attempt with the time the server took it, and derives daily', async () => {
      const data = await submission('ana', await bytesOf(await ranked()), {
        attempt: attemptId,
      });
      const result = await acceptSubmission(db, 's1', data, NOW);
      expect(result).toEqual({ stored: 'l_s1', state: 'submitted' });
      expect((await db.doc('replays/l_s1').get()).data()).toEqual(
        expect.objectContaining({
          kind: 'daily',
          attempt: { id: attemptId, at: declaredAt },
        })
      );
    });

    it('is exempt from the unranked cap, and voided when the ranked cap drops it', async () => {
      const data = await submission('ana', await bytesOf(await ranked()), {
        attempt: attemptId,
      });
      await db
        .doc(`counters/${dayOf(NOW)}`)
        .set({ submissions: DAILY_SUBMISSIONS });
      expect(await acceptSubmission(db, 's1', data, NOW)).toEqual(
        expect.objectContaining({ stored: 'l_s1' })
      );
      await db
        .doc(`counters/${dayOf(NOW)}`)
        .set({ rankedSubmissions: DAILY_RANKED_SUBMISSIONS }, { merge: true });
      expect(await acceptSubmission(db, 's2', data, NOW)).toEqual({
        dropped: 'daily-cap',
      });
      expect(
        (await db.doc(`players/ana/attempts/${attemptId}`).get()).data()
      ).toEqual(
        expect.objectContaining({ void: true, voidReason: 'daily-cap' })
      );
    });

    it('drops a replay whose attempt is unknown, void, or not the one it names', async () => {
      const bytes = await bytesOf(await ranked());
      expect(
        await acceptSubmission(
          db,
          's1',
          await submission('bob', bytes, { attempt: attemptId }),
          NOW
        )
      ).toEqual({ dropped: 'attempt' });
      expect(
        await acceptSubmission(db, 's2', await submission('ana', bytes), NOW)
      ).toEqual({ dropped: 'attempt' });
      await db.doc(`players/ana/attempts/${attemptId}`).update({ void: true });
      expect(
        await acceptSubmission(
          db,
          's3',
          await submission('ana', bytes, { attempt: attemptId }),
          NOW
        )
      ).toEqual({ dropped: 'attempt' });
    });
  });

  describe('online', () => {
    const id = () => engine.onlineReplayId('ABCDEF', 1, onlineSeed);

    it('waits for the second report, then agrees', async () => {
      await room();
      const bytes = await bytesOf(await online());
      expect(
        await acceptSubmission(db, 's1', await submission('host', bytes), NOW)
      ).toEqual({
        stored: id(),
        state: 'waiting',
      });
      const waiting = await db.doc(`replays/${id()}`).get();
      expect(
        (waiting.get('closeAt') as Timestamp).toMillis() -
          (waiting.get('createdAt') as Timestamp).toMillis()
      ).toBe(WAITING_CLOSE_MS);
      expect(
        await acceptSubmission(db, 's2', await submission('guest', bytes), NOW)
      ).toEqual({
        stored: id(),
        state: 'agreed',
      });
      const stored = (await db.doc(`replays/${id()}`).get()).data();
      expect(stored).not.toHaveProperty('closeAt');
      expect(stored).toEqual(
        expect.objectContaining({
          kind: 'online',
          players: ['host', 'guest'],
          bound: true,
          room: expect.objectContaining({
            host: 'host',
            guest: 'guest',
            code: 'ABCDEF',
            n: 1,
          }),
        })
      );
      const reports = await db.collection(`replays/${id()}/reports`).get();
      expect(reports.size).toBe(2);
      expect(
        reports.docs.map((report) =>
          (report.get('expireAt') as Timestamp).toMillis()
        )
      ).toEqual([NOW + 30 * DAY, NOW + 30 * DAY]);
      expect(
        await acceptSubmission(db, 's3', await submission('guest', bytes), NOW)
      ).toEqual({
        dropped: 'duplicate',
      });
    });

    it('keeps the reports and the blob while public, and lets them expire again', async () => {
      await room();
      const bytes = await bytesOf(await online());
      await acceptSubmission(db, 's1', await submission('host', bytes), NOW);
      await acceptSubmission(db, 's2', await submission('guest', bytes), NOW);
      // As if re-run: publishing wants a verified replay with a summary.
      await db.doc(`replays/${id()}`).update({
        state: 'verified',
        summary: {
          sizes: [1, 1],
          endedBy: 'time',
          winnerSeat: null,
          ticks: 120,
          timeline: { left: [], right: [] },
        },
      });
      const expiries = async () =>
        (
          await db.getAll(
            db.doc(`replays/${id()}/blob/data`),
            db.doc(`replays/${id()}/reports/host`),
            db.doc(`replays/${id()}/reports/guest`)
          )
        ).map((doc) =>
          (doc.get('expireAt') as Timestamp | undefined)?.toMillis()
        );
      expect(await publishReplay(db, engine, id(), 'admin', NOW)).toEqual({
        publicId: expect.any(String),
      });
      expect(await expiries()).toEqual([undefined, undefined, undefined]);
      await takeDown(db, id(), NOW);
      const expireAt = (
        (await db.doc(`replays/${id()}`).get()).get('expireAt') as Timestamp
      ).toMillis();
      expect(await expiries()).toEqual([expireAt, expireAt, expireAt]);
    });

    it('does not re-run a match still waiting for its second report', async () => {
      await room();
      const bytes = await bytesOf(await online());
      await acceptSubmission(db, 's1', await submission('host', bytes), NOW);
      expect(
        await verifyStored(
          db,
          engine,
          id(),
          fixedPool('admin'),
          6 * 3600,
          undefined,
          NOW
        )
      ).toBe('waiting');
      expect(
        await acceptSubmission(db, 's2', await submission('guest', bytes), NOW)
      ).toEqual({ stored: id(), state: 'agreed' });
    });

    it('marks reports that differ disputed', async () => {
      await room();
      const replay = await online();
      const other = {
        ...replay,
        header: {
          ...replay.header,
          checksum: ((replay.header.checksum ?? 0) + 1) % 2 ** 32,
        },
      };
      await acceptSubmission(
        db,
        's1',
        await submission('host', await bytesOf(replay)),
        NOW
      );
      expect(
        await acceptSubmission(
          db,
          's2',
          await submission('guest', await bytesOf(other)),
          NOW
        )
      ).toEqual({ stored: id(), state: 'disputed' });
    });

    it('refuses a player the room does not name', async () => {
      await room();
      expect(
        await acceptSubmission(
          db,
          's1',
          await submission('mallory', await bytesOf(await online())),
          NOW
        )
      ).toEqual({ dropped: 'wrong-room' });
    });

    it('keeps a report after the stub expired for its sender, unbound', async () => {
      expect(
        await acceptSubmission(
          db,
          's1',
          await submission('host', await bytesOf(await online())),
          NOW
        )
      ).toEqual({ stored: id(), state: 'waiting' });
      expect((await db.doc(`replays/${id()}`).get()).get('bound')).toBe(false);
    });
  });
});

describe('verification and the gallery', () => {
  async function storedLocal(uid = 'ana', submissionId = 's1') {
    await acceptSubmission(
      db,
      submissionId,
      await submission(uid, await bytesOf(await local())),
      NOW
    );
    return `l_${submissionId}`;
  }

  it('verifies a stored replay once and keeps the summary', async () => {
    const id = await storedLocal();
    const result = await verifyStored(
      db,
      engine,
      id,
      fixedPool('gallery'),
      6 * 3600,
      undefined,
      NOW
    );
    expect(result).toEqual(expect.objectContaining({ state: 'verified' }));
    const stored = (await db.doc(`replays/${id}`).get()).data();
    expect(stored?.['summary']).toEqual(
      expect.objectContaining({ endedBy: 'forfeit', winnerSeat: 1 })
    );
    expect(stored?.['score']).toEqual(expect.any(Number));
    const again = await verifyStored(
      db,
      engine,
      id,
      fixedPool('gallery'),
      6 * 3600,
      undefined,
      NOW
    );
    expect(again).toEqual(expect.objectContaining({ state: 'verified' }));
    expect(again).not.toHaveProperty('rerun');
  });

  it('waits when the budget is spent', async () => {
    const id = await storedLocal();
    expect(
      await reserveVerification(
        db,
        engine,
        'gallery',
        VERIFY_MINUTES.gallery * 3600,
        NOW
      )
    ).toBe(true);
    expect(
      await verifyStored(
        db,
        engine,
        id,
        fixedPool('gallery'),
        6 * 3600,
        undefined,
        NOW
      )
    ).toBe('no-budget');
    expect((await db.doc(`replays/${id}`).get()).get('state')).toBe(
      'submitted'
    );
  });

  it('publishes under a fresh id, names only who opted in, and takes it down again', async () => {
    const id = await storedLocal();
    await db.doc('profiles/ana').set({ name: 'Ana', publicName: true });
    await verifyStored(
      db,
      engine,
      id,
      fixedPool('gallery'),
      6 * 3600,
      undefined,
      NOW
    );
    const published = await publishReplay(db, engine, id, 'auto', NOW);
    expect(published).toEqual({ publicId: expect.any(String) });
    const publicId = (published as { publicId: string }).publicId;
    expect(publicId).not.toBe(id);
    const doc = (await db.doc(`publicReplays/${publicId}`).get()).data();
    expect(doc).toEqual(
      expect.objectContaining({
        replayId: id,
        uids: ['ana'],
        seatUids: ['ana', null],
        removedAt: null,
        featuredBy: 'auto',
        players: [
          { label: 'orange', name: 'Ana', colorId: 'orange', avatarPreset: 0 },
          { label: 'computer', name: null, colorId: 'blue', avatarPreset: 1 },
        ],
      })
    );
    const blob = (
      await db.doc(`publicReplays/${publicId}/blob/data`).get()
    ).get('bytes') as Buffer;
    const replay = await engine.replayFromBytes(new Uint8Array(blob), {
      stored: true,
    });
    expect(replay?.header.client).toBeUndefined();
    const privateCopy = (await db.doc(`replays/${id}`).get()).data();
    expect(privateCopy?.['publicId']).toBe(publicId);
    expect(privateCopy?.['expireAt']).toBeUndefined();
    expect(
      (await db.doc(`replays/${id}/blob/data`).get()).get('expireAt')
    ).toBeUndefined();
    expect(
      (await db.doc(`publicReplays/${publicId}/blob/data`).get()).get(
        'expireAt'
      )
    ).toBeUndefined();
    expect(await publishReplay(db, engine, id, 'auto', NOW)).toBe(
      'already-public'
    );

    expect(await takeDown(db, id, NOW)).toEqual([publicId]);
    expect(
      (await db.doc(`publicReplays/${publicId}`).get()).get('removedAt')
    ).not.toBeNull();
    expect(
      (await db.doc(`publicReplays/${publicId}/blob/data`).get()).exists
    ).toBe(false);
    const expireAt = (await db.doc(`replays/${id}`).get()).get(
      'expireAt'
    ) as Timestamp;
    expect(expireAt).toBeDefined();
    expect(
      (
        (await db.doc(`replays/${id}/blob/data`).get()).get(
          'expireAt'
        ) as Timestamp
      ).toMillis()
    ).toBe(expireAt.toMillis());
  });

  it('keeps out the matches of players who opted out of the gallery', async () => {
    const id = await storedLocal();
    await db.doc('profiles/ana').set({ name: 'Ana', galleryOptOut: true });
    await verifyStored(
      db,
      engine,
      id,
      fixedPool('gallery'),
      6 * 3600,
      undefined,
      NOW
    );
    expect(await publishReplay(db, engine, id, 'auto', NOW)).toBe('opted-out');
  });

  it('re-runs the previous day once and writes the runners-up', async () => {
    const yesterday = NOW - DAY;
    await acceptSubmission(
      db,
      's1',
      await submission('ana', await bytesOf(await local()), {
        createdAt: Timestamp.fromMillis(yesterday),
      }),
      yesterday
    );
    await acceptSubmission(
      db,
      's2',
      await submission('guest', await bytesOf(await local()), {
        createdAt: Timestamp.fromMillis(yesterday),
      }),
      yesterday
    );
    const result = await featureBest(
      db,
      accounts({ guest: { anonymous: true } }),
      NOW,
      Date.now()
    );
    expect(result).toEqual({
      day: dayOf(yesterday),
      checked: 1,
      published: [],
    });
    expect((await db.doc('replays/l_s1').get()).get('state')).toBe('verified');
    expect((await db.doc('replays/l_s2').get()).get('state')).toBe('submitted');
    const candidates = (
      await db.doc(`replayCandidates/${dayOf(yesterday)}`).get()
    ).data();
    expect(candidates).toEqual(
      expect.objectContaining({
        done: true,
        candidates: [expect.objectContaining({ replayId: 'l_s1' })],
      })
    );
    expect(await featureBest(db, accounts(), NOW, Date.now())).toEqual(
      expect.objectContaining({ skipped: 'done' })
    );
  });
});

describe('replayCommand', () => {
  async function command(
    id: string,
    uid: string,
    type: string,
    replayId: string,
    lookup = accounts(),
    writer = uid
  ) {
    const data = {
      uid,
      type,
      replayId,
      createdAt: Timestamp.fromMillis(NOW),
      expireAt: Timestamp.fromMillis(NOW + DAY),
    };
    await db.doc(`replayCommands/${id}`).set(data);
    const result = await runReplayCommand(db, lookup, id, data, writer, NOW);
    expect((await db.doc(`replayCommands/${id}`).get()).get('result')).toEqual(
      expect.objectContaining({ ok: result.ok })
    );
    return result;
  }

  const admin = accounts({ owner: { admin: true } });

  beforeEach(async () => {
    await acceptSubmission(
      db,
      's1',
      await submission('ana', await bytesOf(await local())),
      NOW
    );
  });

  it('counts a command only from the uid it names', async () => {
    expect(
      await command('c1', 'ana', 'remove', 'l_s1', accounts(), 'mallory')
    ).toEqual({
      ok: false,
      reason: 'not-writer',
    });
  });

  it('lets the owner feature, anonymise and unfeature, with an audit', async () => {
    await db.doc('profiles/ana').set({ name: 'Ana', publicName: true });
    expect(await command('c1', 'ana', 'feature', 'l_s1')).toEqual({
      ok: false,
      reason: 'not-admin',
    });
    const featured = await command('c2', 'owner', 'feature', 'l_s1', admin);
    expect(featured).toEqual({ ok: true, publicId: expect.any(String) });
    expect((await db.doc('replays/l_s1').get()).get('state')).toBe('verified');
    expect(await command('c3', 'owner', 'anonymise', 'l_s1', admin)).toEqual({
      ok: true,
    });
    const publicId = featured.publicId as string;
    const players = (await db.doc(`publicReplays/${publicId}`).get()).get(
      'players'
    );
    expect(players[0].name).toBeNull();
    await onProfileChanged(
      db,
      'ana',
      { name: 'Ana', publicName: true },
      { name: 'Anna', publicName: true },
      NOW
    );
    expect(
      (await db.doc(`publicReplays/${publicId}`).get()).get('players')[0].name
    ).toBeNull();
    expect(await command('c4', 'owner', 'unfeature', 'l_s1', admin)).toEqual({
      ok: true,
    });
    expect((await db.doc('adminAudit/c2').get()).data()).toEqual(
      expect.objectContaining({
        by: 'owner',
        type: 'replay.feature',
        source: 'replayCommand',
        ok: true,
        target: { replayId: 'l_s1' },
      })
    );
  });

  it('lets a player take their replay down for good', async () => {
    const featured = await command('c1', 'owner', 'feature', 'l_s1', admin);
    expect(await command('c2', 'bob', 'remove', 'l_s1')).toEqual({
      ok: false,
      reason: 'not-yours',
    });
    expect(await command('c3', 'ana', 'remove', 'l_s1')).toEqual({ ok: true });
    expect(
      (await db.doc(`publicReplays/${featured.publicId}`).get()).get(
        'removedAt'
      )
    ).not.toBeNull();
    expect((await db.doc('replays/l_s1').get()).get('optOut')).toEqual(['ana']);
    expect(await command('c4', 'owner', 'feature', 'l_s1', admin)).toEqual({
      ok: false,
      reason: 'opted-out',
    });
  });

  it('does a command once', async () => {
    const data = {
      uid: 'ana',
      type: 'remove',
      replayId: 'l_s1',
      result: { ok: true },
    };
    expect(
      await runReplayCommand(db, accounts(), 'c1', data, 'ana', NOW)
    ).toEqual({
      ok: false,
      reason: 'done',
    });
  });
});

describe('profiles and deleted accounts', () => {
  async function featuredLocal(uid: string, submissionId: string) {
    await acceptSubmission(
      db,
      submissionId,
      await submission(uid, await bytesOf(await local())),
      NOW
    );
    await verifyStored(
      db,
      engine,
      `l_${submissionId}`,
      fixedPool('gallery'),
      6 * 3600,
      undefined,
      NOW
    );
    const published = await publishReplay(
      db,
      engine,
      `l_${submissionId}`,
      'auto',
      NOW
    );
    return (published as { publicId: string }).publicId;
  }

  it('snapshots the name again, removes it, and takes the gallery down on opt-out', async () => {
    await db.doc('profiles/ana').set({ name: 'Ana', publicName: true });
    const publicId = await featuredLocal('ana', 's1');
    const name = async () =>
      (await db.doc(`publicReplays/${publicId}`).get()).get('players')[0].name;
    expect(await name()).toBe('Ana');
    await onProfileChanged(
      db,
      'ana',
      { name: 'Ana', publicName: true },
      { name: 'Anna', publicName: true },
      NOW
    );
    expect(await name()).toBe('Anna');
    await onProfileChanged(
      db,
      'ana',
      { name: 'Anna', publicName: true },
      { name: 'Anna', publicName: false },
      NOW
    );
    expect(await name()).toBeNull();
    expect(
      await onProfileChanged(
        db,
        'ana',
        { name: 'Anna', motto: 'a' },
        { name: 'Anna', motto: 'b' },
        NOW
      )
    ).toBe(0);
    await onProfileChanged(
      db,
      'ana',
      { name: 'Anna' },
      { name: 'Anna', galleryOptOut: true },
      NOW
    );
    expect(
      (await db.doc(`publicReplays/${publicId}`).get()).get('removedAt')
    ).not.toBeNull();
  });

  it('erases a deleted account from its replays', async () => {
    await db.doc('profiles/ana').set({ name: 'Ana', publicName: true });
    const publicId = await featuredLocal('ana', 's1');
    await room();
    const bytes = await bytesOf(await online());
    await acceptSubmission(db, 's2', await submission('host', bytes), NOW);
    await acceptSubmission(db, 's3', await submission('guest', bytes), NOW);
    await db.doc('limits/ana').set({ count: 1 });

    expect(await deletePlayerReplays(db, 'ana')).toEqual({
      deleted: 1,
      kept: 0,
      unnamed: 1,
    });
    expect((await db.doc('replays/l_s1').get()).exists).toBe(false);
    expect((await db.doc('replays/l_s1/blob/data').get()).exists).toBe(false);
    const publicDoc = (await db.doc(`publicReplays/${publicId}`).get()).data();
    expect(publicDoc?.['uids']).toEqual([]);
    expect(publicDoc?.['players'][0].name).toBeNull();
    expect((await db.doc('limits/ana').get()).exists).toBe(false);

    const onlineId = engine.onlineReplayId('ABCDEF', 1, onlineSeed);
    expect(await deletePlayerReplays(db, 'host')).toEqual({
      deleted: 0,
      kept: 1,
      unnamed: 0,
    });
    expect((await db.doc(`replays/${onlineId}`).get()).get('players')).toEqual([
      'guest',
    ]);
    expect(
      (await db.doc(`replays/${onlineId}/reports/host`).get()).exists
    ).toBe(false);
  });
});
