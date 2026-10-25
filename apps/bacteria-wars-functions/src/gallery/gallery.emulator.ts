import {
  BALANCE_VERSION,
  boardAvatar,
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
import { publicProfileChanged } from './publish';

/**
 * The gallery against the Firestore emulator (`test-emulator`):
 * `featureBest` picks, re-runs, scores and publishes a day's best match,
 * once, and `remove` takes it down again; the owner's `feature`,
 * `unfeature` and `anonymise` curate it by hand.
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

  it("follows the player's profile: a hidden name, then opting out", async () => {
    const profile = { name: 'Ada', publicName: true };
    await db.doc('profiles/ada').set(profile);
    await store('l_a', 'ada');
    await pick();
    const publicId = String(
      (await db.doc('replays/l_a').get()).get('publicId')
    );
    const hidden = { ...profile, publicName: false };
    await publicProfileChanged(db, 'ada', profile, hidden, NOW);
    const published = db.doc(`publicReplays/${publicId}`);
    expect((await published.get()).get('players')[0]).toMatchObject({
      name: null,
    });
    await publicProfileChanged(
      db,
      'ada',
      hidden,
      { ...hidden, galleryOptOut: true },
      NOW
    );
    expect((await published.get()).get('removedAt')).not.toBeNull();
    expect((await db.doc('replays/l_a').get()).get('galleryOut')).toBe(true);
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
      await runReplayCommand(
        db,
        'c1',
        command,
        'ada',
        { isOwner: async () => false },
        NOW + HOUR
      )
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

describe("the owner's curation", () => {
  /** Runs the owner's replay command `id`, re-running with `verify`. */
  async function curate(
    id: string,
    type: string,
    replayId: string,
    verify: () => Verdict = thriller
  ) {
    const command = { uid: 'own', type, replayId };
    await db.doc(`replayCommands/${id}`).set(command);
    let t = 0;
    return runReplayCommand(
      db,
      id,
      command,
      'own',
      {
        isOwner: async (uid) => uid === 'own',
        clock: () => (t += 1_000),
        verify,
      },
      NOW
    );
  }

  const publicIdOf = async (replayId: string) =>
    (await db.doc(`replays/${replayId}`).get()).get('publicId') as
      | string
      | undefined;

  it("features a guest's match by hand, re-run first, and audits it", async () => {
    await store('l_a', 'guest');
    expect(await curate('c1', 'feature', 'l_a')).toEqual({ ok: true });
    const publicId = String(await publicIdOf('l_a'));
    expect(
      (await db.doc(`publicReplays/${publicId}`).get()).data()
    ).toMatchObject({ replayId: 'l_a', featuredBy: 'admin', removedAt: null });
    expect((await db.doc('replays/l_a').get()).data()).toMatchObject({
      state: 'verified',
      medal: 'gold',
    });
    expect(
      (await db.doc('counters/2026-10-26').get()).get('adminVerifyMs')
    ).toBeGreaterThan(0);
    expect((await db.doc('adminAudit/c1').get()).data()).toMatchObject({
      by: 'own',
      type: 'replay.feature',
      target: { replayId: 'l_a' },
      source: 'replayCommand',
      ok: true,
      before: { state: 'submitted' },
      after: { publicId },
    });
    // A second delivery answers from the audit and runs nothing.
    expect(await curate('c1', 'feature', 'l_a')).toEqual({ ok: true });
    expect((await db.collection('publicReplays').get()).size).toBe(1);
    expect(await curate('c2', 'feature', 'l_a')).toEqual({
      ok: false,
      reason: 'already-public',
    });
  });

  it("refuses what a player took down, what fails its re-run, and what the budget can't pay", async () => {
    await store('l_a', 'ada');
    await db.doc('replays/l_a').update({ optOut: ['ada'], galleryOut: true });
    expect(await curate('c1', 'feature', 'l_a')).toEqual({
      ok: false,
      reason: 'not-eligible',
    });
    expect((await db.doc('adminAudit/c1').get()).get('error')).toBe(
      'not-eligible'
    );
    await store('l_b', 'bob');
    expect(
      await curate('c2', 'feature', 'l_b', () => ({
        state: 'unverified',
        ms: 0,
      }))
    ).toEqual({ ok: false, reason: 'not-verified' });
    expect((await db.doc('replays/l_b').get()).get('state')).toBe('unverified');
    await store('l_c', 'cid');
    await db.doc('counters/2026-10-26').set({ adminVerifyMs: 400_000 });
    expect(await curate('c3', 'feature', 'l_c')).toEqual({
      ok: false,
      reason: 'no-budget',
    });
    expect(await curate('c4', 'feature', 'nope')).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('unfeatures by the public id, and may feature it again', async () => {
    await store('l_a', 'ada');
    await curate('c1', 'feature', 'l_a');
    const publicId = String(await publicIdOf('l_a'));
    expect(await curate('c2', 'unfeature', publicId)).toEqual({ ok: true });
    expect(
      (await db.doc(`publicReplays/${publicId}`).get()).get('removedAt')
    ).not.toBeNull();
    expect(await publicIdOf('l_a')).toBeUndefined();
    expect(await curate('c3', 'unfeature', publicId)).toEqual({
      ok: false,
      reason: 'not-public',
    });
    // Verified now: featured again without a re-run, keeping the score
    // stored (`featureBest` may have given it the best-daily feat).
    await db.doc('replays/l_a').update({ score: 99, reasons: ['feat'] });
    expect(
      await curate('c4', 'feature', 'l_a', () => {
        throw new Error('re-ran a verified replay');
      })
    ).toEqual({ ok: true });
    const again = String(await publicIdOf('l_a'));
    expect(again).not.toBe(publicId);
    expect((await db.doc(`publicReplays/${again}`).get()).data()).toMatchObject(
      { score: 99, reasons: ['feat'] }
    );
  });

  it('anonymises by the private id, for good', async () => {
    const profile = {
      name: 'Ada',
      publicName: true,
      avatar: { kind: 'preset', id: 7 },
    };
    await db.doc('profiles/ada').set(profile);
    await store('l_a', 'ada');
    await curate('c1', 'feature', 'l_a');
    const publicId = String(await publicIdOf('l_a'));
    const published = db.doc(`publicReplays/${publicId}`);
    expect((await published.get()).get('players')[0]).toMatchObject({
      name: 'Ada',
      avatarPreset: 7,
    });
    expect(await curate('c2', 'anonymise', 'l_a')).toEqual({ ok: true });
    // No name, and the preset of a player who keeps their name private.
    const anonymous = {
      name: null,
      avatarPreset: boardAvatar(`${publicId}_0`),
    };
    expect((await published.get()).data()).toMatchObject({
      anonymised: true,
      uids: ['ada'],
    });
    expect((await published.get()).get('players')).toMatchObject([
      anonymous,
      { label: 'computer' },
    ]);
    // The audit keeps no names.
    expect(
      JSON.stringify((await db.doc('adminAudit/c2').get()).data())
    ).not.toContain('Ada');
    // A new name or preset does not bring them back...
    await publicProfileChanged(
      db,
      'ada',
      profile,
      { ...profile, name: 'Adele', avatar: { kind: 'preset', id: 3 } },
      NOW
    );
    expect((await published.get()).get('players')[0]).toMatchObject(anonymous);
    // ...nor a new public copy.
    await curate('c3', 'unfeature', publicId);
    expect(await curate('c4', 'feature', 'l_a')).toEqual({ ok: true });
    const again = String(await publicIdOf('l_a'));
    expect((await db.doc(`publicReplays/${again}`).get()).data()).toMatchObject(
      {
        anonymised: true,
        players: [{ name: null, avatarPreset: boardAvatar(`${again}_0`) }, {}],
      }
    );
  });
});
