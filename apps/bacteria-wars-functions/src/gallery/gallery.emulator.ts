import {
  BALANCE_VERSION,
  replayFromBytes,
  replayToBytes,
} from '@wolsok/feat-lazy-bac-game/engine';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';
import type { Verdict } from '../boards/verify';
import { clearBanCache } from '../limits';
import { runReplayCommand } from '../replays/command';
import { deletePlayerReplays } from '../replays/delete-player';
import { dailyReplay, TICKS } from '../testing/daily-replay';
import { featureBest } from './feature-best';

/**
 * The gallery against the Firestore emulator (`test-emulator`):
 * `featureBest` picks, re-runs, scores and publishes a day's best match,
 * once, and `remove` takes it down again.
 */
const PROJECT = 'demo-bacteria-functions';
if (getApps().length === 0) {
  initializeApp({ projectId: PROJECT });
}
const db = getFirestore();

const HOUR = 3_600_000;
/** 04:00 on the 26th: the pick for the 25th. */
const NOW = Date.UTC(2026, 9, 26, 3);
const PLAYED = Date.UTC(2026, 9, 25, 18);
const old = async () => ({ createdAt: NOW - 30 * DAY_MS, google: true });

beforeEach(async () => {
  clearBanCache();
  await fetch(
    `http://${process.env['FIRESTORE_EMULATOR_HOST']}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
});

/** A local match of `uid` against the computer, stored as acceptReplay does. */
async function store(id: string, uid: string, hint = 80) {
  const replay = dailyReplay({ attempt: undefined, client: 'test-1.0' }, uid);
  await db.doc(`replays/${id}`).set({
    kind: 'computer',
    levelId: replay.header.levelId,
    balanceVersion: BALANCE_VERSION,
    ticks: TICKS,
    endedBy: 'annihilation',
    winnerSeat: 0,
    hint,
    players: [uid],
    state: 'submitted',
    optOut: [],
    createdAt: Timestamp.fromMillis(PLAYED),
    expireAt: Timestamp.fromMillis(PLAYED + 30 * DAY_MS),
  });
  await db
    .doc(`replays/${id}/blob/data`)
    .set({ bytes: Buffer.from(await replayToBytes(replay)) });
}

/**
 * A close match with a comeback and leads changing: well over 60 points.
 * One sample a second, both seats.
 */
const thriller = (): Verdict => {
  const timeline: number[] = [];
  for (let second = 1; second <= TICKS / 60; second++) {
    const pair = second === 30 ? [4, 10] : second % 2 === 0 ? [10, 8] : [8, 10];
    timeline.push(...pair);
  }
  timeline.splice(-2, 2, 10, 8);
  return {
    state: 'verified',
    summary: {
      ticks: TICKS,
      endedBy: 'annihilation',
      winnerSeat: 0,
      sizes: [10, 8],
      timeline,
    },
    medal: 'gold',
    ms: 0,
  };
};

async function pick(verify: () => Verdict = thriller) {
  let t = 0;
  return featureBest(db, NOW, old, () => (t += 1_000), verify);
}

describe('featureBest', () => {
  it("re-runs, scores and publishes the day's best match, once", async () => {
    await db.doc('profiles/ada').set({ name: 'Ada', publicName: true });
    await store('l_a', 'ada');
    const result = await pick();
    expect(result).toMatchObject({ day: '2026-10-25', checked: 1 });
    expect(result.published).toEqual(['l_a']);

    const replay = (await db.doc('replays/l_a').get()).data() ?? {};
    expect(replay).toMatchObject({ state: 'verified', medal: 'gold' });
    expect(replay['score']).toBeGreaterThanOrEqual(60);
    expect(replay['expireAt']).toBeUndefined();
    const publicId = String(replay['publicId']);
    expect(publicId).not.toBe('l_a');

    const published = (await db.doc(`publicReplays/${publicId}`).get()).data();
    expect(published).toMatchObject({
      replayId: 'l_a',
      uids: ['ada'],
      kind: 'computer',
      featuredBy: 'auto',
      day: '2026-10-25',
      removedAt: null,
    });
    expect(published?.['players']).toMatchObject([
      { name: 'Ada' },
      { label: 'computer', name: null },
    ]);
    // The public bytes carry no app version.
    const blob = await db.doc(`publicReplays/${publicId}/blob/data`).get();
    const bytes = new Uint8Array(blob.get('bytes') as Buffer);
    expect(
      (await replayFromBytes(bytes, { stored: true }))?.header.client
    ).toBe(undefined);
    expect(
      (await db.doc('replayCandidates/2026-10-25').get()).get('done')
    ).toBe(true);
    // The re-run counts in the level statistics like the boards'.
    const stats = await db.collection('levelStats').get();
    expect(stats.docs[0]?.data()).toMatchObject({
      rerun: 1,
      medals: { gold: 1 },
    });
    expect(await pick()).toMatchObject({ skipped: 'done' });
    expect((await db.collection('publicReplays').get()).size).toBe(1);
  });

  it('keeps out a player who opted out, and an unverified match', async () => {
    await db.doc('profiles/bob').set({ galleryOptOut: true });
    await store('l_b', 'bob');
    await store('l_c', 'cid');
    const result = await pick(() => ({ state: 'unverified', ms: 0 }));
    expect(result).toMatchObject({ checked: 1, published: [] });
    expect((await db.doc('replays/l_c').get()).get('state')).toBe('unverified');
    expect((await db.collection('publicReplays').get()).empty).toBe(true);
  });

  it("spends nothing on a banned player's match", async () => {
    await db.doc('bans/ada').set({ until: null, reason: 'cheating' });
    await store('l_a', 'ada');
    expect(await pick()).toMatchObject({ checked: 0, published: [] });
    expect((await db.doc('replays/l_a').get()).get('state')).toBe('submitted');
  });

  it('publishes a match the boards verified, with no budget left to re-run', async () => {
    await store('l_a', 'ada');
    await db.doc('replays/l_a').update({
      state: 'verified',
      attempt: { id: 'd_2026-10-25_1', at: PLAYED },
      summary: thriller().summary,
    });
    await db.doc('counters/2026-10-26').set({ galleryVerifyMs: 25 * 60_000 });
    const result = await pick(() => {
      throw new Error('re-ran a verified replay');
    });
    expect(result).toMatchObject({ checked: 0, published: ['l_a'] });
  });

  it("takes a deleted account's uid and name out of its public replays", async () => {
    await db.doc('profiles/ada').set({ name: 'Ada', publicName: true });
    await store('l_a', 'ada');
    await pick();
    const publicId = String(
      (await db.doc('replays/l_a').get()).get('publicId')
    );
    await deletePlayerReplays(db, 'ada');
    const published = (await db.doc(`publicReplays/${publicId}`).get()).data();
    expect(published).toMatchObject({ uids: [], seatUids: [null, null] });
    expect(published?.['players'][0]).toMatchObject({ name: null });
  });

  it('takes a public replay down on remove, and lets it expire again', async () => {
    await store('l_a', 'ada');
    await pick();
    const publicId = String(
      (await db.doc('replays/l_a').get()).get('publicId')
    );
    const command = { uid: 'ada', type: 'remove', replayId: 'l_a' };
    await db.doc('replayCommands/c1').set(command);
    expect(
      await runReplayCommand(db, 'c1', command, 'ada', NOW + HOUR)
    ).toEqual({ ok: true });
    const published = await db.doc(`publicReplays/${publicId}`).get();
    expect(published.get('removedAt')).not.toBeNull();
    expect(
      (await db.doc(`publicReplays/${publicId}/blob/data`).get()).exists
    ).toBe(false);
    const replay = await db.doc('replays/l_a').get();
    expect(replay.get('publicId')).toBeUndefined();
    expect(replay.get('expireAt')?.toMillis()).toBe(PLAYED + 30 * DAY_MS);
  });
});
