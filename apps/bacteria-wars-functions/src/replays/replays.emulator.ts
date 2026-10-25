import {
  BALANCE_VERSION,
  parseReplay,
  type Replay,
  type ReplayHeader,
  replayToBytes,
} from '@wolsok/feat-lazy-bac-game/engine';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clearBanCache } from '../limits';
import { acceptSubmission } from './accept';
import { deleteReplayChildren } from './cleanup';
import { runReplayCommand } from './command';
import { deletePlayerReplays } from './delete-player';

/**
 * The replay functions against the Firestore emulator (`test-emulator`):
 * what acceptReplay, replayCommand and deletePlayerReplays leave behind.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const NOW = Date.now();
const HOUR = 3_600_000;

const golden = parseReplay(
  JSON.parse(
    readFileSync(
      join(
        __dirname,
        '../../../../libs/features/lazy/bacteria-game/src/lib/state/golden-replay.json'
      ),
      'utf8'
    )
  )
) as Replay;

/** The golden replay as a device would store it, with `header` on top. */
async function bytesOf(
  header: Partial<ReplayHeader> = {},
  inputs: Replay['inputs'] = golden.inputs
): Promise<Buffer> {
  const replay: Replay = {
    ...golden,
    inputs,
    header: {
      ...golden.header,
      balanceVersion: BALANCE_VERSION,
      outcome: { endedBy: 'time', winnerSeat: 1 },
      checksum: 196095863,
      ...header,
    },
  };
  // Stored replays must parse strictly - check the fixture does.
  expect(
    parseReplay(JSON.parse(JSON.stringify(replay)), { stored: true })
  ).not.toBeNull();
  return Buffer.from(await replayToBytes(replay));
}

const online = (n = 1): Partial<ReplayHeader> => ({
  mode: 'two-players',
  headStart: 0,
  seats: [{ isBot: false }, { isBot: false }],
  roomCode: 'ABC234',
  n,
});

/** Writes a submission and hands it to the function, as the trigger does. */
async function submit(
  id: string,
  uid: string,
  bytes: Buffer,
  extra: object = {}
) {
  const ref = db.doc(`replaySubmissions/${id}`);
  await ref.set({
    uid,
    bytes,
    hint: 40,
    createdAt: Timestamp.fromMillis(NOW),
    expireAt: Timestamp.fromMillis(NOW + 24 * HOUR),
    ...extra,
  });
  const data = (await ref.get()).data() ?? {};
  return acceptSubmission(db, id, data, NOW);
}

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

describe('acceptReplay', () => {
  it('stores a match against the computer, its bytes beside it', async () => {
    const bytes = await bytesOf();
    expect(await submit('s1', 'ada', bytes)).toBe('stored');
    const replay = await db.doc('replays/l_s1').get();
    expect(replay.data()).toMatchObject({
      players: ['ada'],
      kind: 'computer',
      levelId: 'quarantine',
      balanceVersion: BALANCE_VERSION,
      replayVersion: 2,
      simulation: 'cpu',
      ticks: 360,
      endedBy: 'time',
      winnerSeat: 1,
      hint: 40,
      state: 'submitted',
      optOut: [],
    });
    expect(replay.get('expireAt').toMillis()).toBeGreaterThan(
      NOW + 29 * 24 * HOUR
    );
    const blob = await db.doc('replays/l_s1/blob/data').get();
    expect(blob.get('size')).toBe(bytes.length);
    expect((await db.doc('replaySubmissions/s1').get()).exists).toBe(false);
  });

  it('stores a submission once, however often it arrives', async () => {
    const bytes = await bytesOf();
    await submit('s1', 'ada', bytes);
    expect(await submit('s1', 'ada', bytes)).toBe('exists');
  });

  it('drops what a banned player sends, while the ban holds', async () => {
    await db.doc('bans/eve').set({ until: Timestamp.fromMillis(NOW + HOUR) });
    expect(await submit('s1', 'eve', await bytesOf())).toBe('banned');
    expect((await db.doc('replays/l_s1').get()).exists).toBe(false);
    expect((await db.doc('replaySubmissions/s1').get()).exists).toBe(false);
    await db.doc('bans/eve').set({ until: Timestamp.fromMillis(NOW - 1) });
    clearBanCache();
    expect(await submit('s2', 'eve', await bytesOf())).toBe('stored');
  });

  it("keeps a player within the hour's submissions", async () => {
    await db
      .doc('limits/ada')
      .set({ hour: Math.floor(NOW / HOUR), submissions: 60 });
    expect(await submit('s1', 'ada', await bytesOf())).toBe('limit');
    await db
      .doc('limits/ada')
      .set({ hour: Math.floor(NOW / HOUR) - 1, submissions: 60 });
    expect(await submit('s2', 'ada', await bytesOf())).toBe('stored');
    expect((await db.doc('limits/ada').get()).get('submissions')).toBe(1);
  });

  it('drops bytes that are no replay', async () => {
    expect(await submit('s1', 'ada', Buffer.from([1, 2, 3]))).toBe(
      'unparsable'
    );
  });

  describe('an online match', () => {
    beforeEach(() =>
      db.doc('rooms/ABC234').set({
        host: 'ada',
        guest: 'bob',
        taken: true,
        createdAt: Timestamp.fromMillis(NOW - HOUR),
        expireAt: Timestamp.fromMillis(NOW + HOUR),
      })
    );

    it('waits for the second report, then agrees', async () => {
      const bytes = await bytesOf(online());
      expect(await submit('s1', 'ada', bytes)).toBe('stored');
      const [id] = (await db.collection('replays').listDocuments()).map(
        (ref) => ref.id
      );
      expect(id).toMatch(/^o_/);
      expect((await db.doc(`replays/${id}`).get()).data()).toMatchObject({
        kind: 'online',
        players: ['ada'],
        state: 'waiting',
        room: 'ABC234',
        seats: ['ada', 'bob'],
        stubExpired: false,
      });
      expect(
        (await db.doc(`replays/${id}`).get()).get('stubCreatedAt').toMillis()
      ).toBe(NOW - HOUR);
      expect(await submit('s2', 'bob', bytes)).toBe('reported');
      expect((await db.doc(`replays/${id}`).get()).data()).toMatchObject({
        players: ['ada', 'bob'],
        state: 'agreed',
      });
      expect(
        (await db.collection(`replays/${id}/reports`).listDocuments())
          .map((ref) => ref.id)
          .sort()
      ).toEqual(['ada', 'bob']);
    });

    it('is disputed when the two devices saw different matches', async () => {
      await submit('s1', 'ada', await bytesOf(online()));
      expect(
        await submit('s2', 'bob', await bytesOf({ ...online(), checksum: 1 }))
      ).toBe('reported');
      const [ref] = await db.collection('replays').listDocuments();
      expect((await ref.get()).get('state')).toBe('disputed');
    });

    it('is disputed when a report brings other inputs to the same outcome', async () => {
      await submit('s1', 'ada', await bytesOf(online()));
      const doctored = {
        ...golden.inputs,
        drags: golden.inputs.drags.slice(0, 1),
      };
      expect(await submit('s2', 'bob', await bytesOf(online(), doctored))).toBe(
        'reported'
      );
      const [ref] = await db.collection('replays').listDocuments();
      expect((await ref.get()).get('state')).toBe('disputed');
    });

    it('takes reports from the players of its room only, once each', async () => {
      const bytes = await bytesOf(online());
      expect(await submit('s1', 'eve', bytes)).toBe('not-in-room');
      await submit('s2', 'ada', bytes);
      expect(await submit('s3', 'ada', bytes)).toBe('duplicate');
    });

    it('marks a match reported after its stub expired', async () => {
      await db
        .doc('rooms/ABC234')
        .update({ expireAt: Timestamp.fromMillis(NOW - 1) });
      await submit('s1', 'ada', await bytesOf(online()));
      const [ref] = await db.collection('replays').listDocuments();
      expect((await ref.get()).get('stubExpired')).toBe(true);
    });
  });
});

describe('replayCommand', () => {
  beforeEach(async () => {
    await db.doc('replays/r1').set({ players: ['ada', 'bob'], optOut: [] });
    await db.doc('publicReplays/p1').set({ replayId: 'r1', removedAt: null });
  });

  const run = (data: object, authId: string | undefined) =>
    db
      .doc('replayCommands/c1')
      .set(data)
      .then(() =>
        runReplayCommand(db, 'c1', data as Record<string, unknown>, authId, NOW)
      );

  it("takes a player's match out of the gallery for good", async () => {
    const result = await run(
      { uid: 'ada', type: 'remove', replayId: 'r1' },
      'ada'
    );
    expect(result).toEqual({ ok: true });
    expect((await db.doc('replays/r1').get()).get('optOut')).toEqual(['ada']);
    expect(
      (await db.doc('publicReplays/p1').get()).get('removedAt')
    ).not.toBeNull();
    expect(
      (await db.doc('replayCommands/c1').get()).get('result')
    ).toMatchObject({
      ok: true,
    });
  });

  it('refuses a writer acting for another player, or a stranger to the match', async () => {
    expect(
      await run({ uid: 'ada', type: 'remove', replayId: 'r1' }, 'eve')
    ).toEqual({ ok: false, reason: 'not-writer' });
    expect(
      await run({ uid: 'eve', type: 'remove', replayId: 'r1' }, 'eve')
    ).toEqual({ ok: false, reason: 'not-found' });
  });

  it('refuses a banned player, and the types still to come', async () => {
    await db.doc('bans/ada').set({ until: null });
    expect(
      await run({ uid: 'ada', type: 'remove', replayId: 'r1' }, 'ada')
    ).toEqual({ ok: false, reason: 'banned' });
    expect(
      await run({ uid: 'own', type: 'feature', replayId: 'r1' }, 'own')
    ).toEqual({ ok: false, reason: 'unsupported' });
  });
});

describe('cleanReplay', () => {
  it('takes the blob and the reports of a deleted replay along', async () => {
    await db.doc('replays/r1/blob/data').set({ size: 1 });
    await db.doc('replays/r1/reports/ada').set({ checksum: 1 });
    await deleteReplayChildren(db, 'r1');
    expect((await db.doc('replays/r1/blob/data').get()).exists).toBe(false);
    expect((await db.doc('replays/r1/reports/ada').get()).exists).toBe(false);
  });
});

describe('deletePlayerReplays', () => {
  it('deletes what only the player played, and leaves the rest to the others', async () => {
    await db.doc('replays/mine').set({ players: ['ada'] });
    await db.doc('replays/mine/blob/data').set({ size: 1 });
    await db
      .doc('replays/ours')
      .set({ players: ['ada', 'bob'], optOut: ['ada'] });
    await db.doc('replays/ours/reports/ada').set({ checksum: 1 });
    expect(await deletePlayerReplays(db, 'ada')).toEqual({
      deleted: 1,
      left: 1,
    });
    expect((await db.doc('replays/mine').get()).exists).toBe(false);
    expect((await db.doc('replays/mine/blob/data').get()).exists).toBe(false);
    expect((await db.doc('replays/ours').get()).data()).toEqual({
      players: ['bob'],
      optOut: [],
    });
    expect((await db.doc('replays/ours/reports/ada').get()).exists).toBe(false);
  });
});
