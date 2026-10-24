import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import type { ReplayCommandType } from '@wolsok/feat-lazy-bac-game/engine';
import { AccountLookup, isAdminNow } from '../accounts';
import { AUDIT_YEARS } from '../config';
import { Engine, loadEngine } from '../engine';
import { assertActive, Banned } from '../limits';
import { DAY_MS } from '../time';
import { fixedPool, MAX_GALLERY_MINUTES, minuteTicks } from './budgets';
import type { ReplayDoc } from './model';
import { publishReplay, takeDown } from './publish';
import { verifyStored } from './verify';

/**
 * What the function writes back on the command - the writer may read it.
 * `ok` and `reason` are what the client reads (`parseCommandResult` of
 * the game's `replay-records.ts`); `reason` is an id, never a text.
 */
export interface ReplayCommandResult {
  ok: boolean;
  reason?: string;
  publicId?: string;
}

/**
 * `replayCommand` (ADR 0011, changed by ADR 0012): acts on a
 * `replayCommands` document. `remove` by one of the replay's players takes
 * its public copy down and records them in `optOut`, so nothing features it
 * again, not even the owner. `feature`, `unfeature` and `anonymise` only by
 * the owner, whose claim is read again from Auth. Featuring a replay not
 * verified yet re-runs it first, from the admin budget, at most 6 minutes
 * of match. The admin types leave an `adminAudit` entry.
 *
 * `writer` is the event's `authId`: a command counts only when its writer
 * is the `uid` it names. Idempotent: a command with a result is done.
 */
export async function runReplayCommand(
  db: Firestore,
  accounts: AccountLookup,
  commandId: string,
  data: Record<string, unknown> | undefined,
  writer: string | undefined,
  now = Date.now()
): Promise<ReplayCommandResult> {
  const ref = db.doc(`replayCommands/${commandId}`);
  if (data === undefined || data['result'] !== undefined) {
    return { ok: false, reason: 'done' };
  }
  const { uid, type, replayId } = data;
  let result: ReplayCommandResult;
  if (
    typeof uid !== 'string' ||
    typeof replayId !== 'string' ||
    !PLAIN_ID.test(replayId)
  ) {
    result = { ok: false, reason: 'invalid' };
  } else if (writer !== uid) {
    result = { ok: false, reason: 'not-writer' };
  } else if (type === 'remove') {
    // A player's own command needs no engine: their replay is read by id.
    result = await remove(db, uid, replayId, now);
  } else {
    result = await curateChecked(
      db,
      accounts,
      commandId,
      uid,
      type,
      replayId,
      now
    );
  }
  await ref.update({
    result: { ...result, at: Timestamp.fromMillis(now) },
  });
  return result;
}

/**
 * An id `replays/{id}` can name, no path - what every replay id is made of.
 * The engine's `REPLAY_ID` checks the exact shape for the owner's commands;
 * a `remove` of an id no replay has finds no replay of the player.
 */
const PLAIN_ID = /^[A-Za-z0-9_]{1,64}$/;

/** The owner's commands, with the engine: the type and the id checked, then the claim. */
async function curateChecked(
  db: Firestore,
  accounts: AccountLookup,
  commandId: string,
  uid: string,
  type: unknown,
  replayId: string,
  now: number
): Promise<ReplayCommandResult> {
  const engine = await loadEngine();
  if (
    !engine.isReplayCommandType(type) ||
    type === 'remove' ||
    !engine.REPLAY_ID.test(replayId)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  if (!(await isAdminNow(accounts, uid))) {
    return { ok: false, reason: 'not-admin' };
  }
  return curate(db, engine, commandId, uid, type, replayId, now);
}

/** A player takes one of their replays out of the gallery for good. */
async function remove(
  db: Firestore,
  uid: string,
  replayId: string,
  now: number
): Promise<ReplayCommandResult> {
  try {
    await assertActive(db, uid, now);
  } catch (error) {
    if (error instanceof Banned) {
      return { ok: false, reason: 'banned' };
    }
    throw error;
  }
  const replayRef = db.doc(`replays/${replayId}`);
  const replay = await replayRef.get();
  if (!((replay.get('players') as string[] | undefined) ?? []).includes(uid)) {
    return { ok: false, reason: 'not-yours' };
  }
  await replayRef.update({ optOut: FieldValue.arrayUnion(uid) });
  await takeDown(db, replayId, now);
  return { ok: true };
}

/** The owner features, unfeatures or anonymises a replay. */
async function curate(
  db: Firestore,
  engine: Engine,
  commandId: string,
  uid: string,
  type: Exclude<ReplayCommandType, 'remove'>,
  replayId: string,
  now: number
): Promise<ReplayCommandResult> {
  const before = await publicIdsOf(db, replayId);
  let result: ReplayCommandResult;
  switch (type) {
    case 'feature':
      result = await feature(db, engine, replayId, now);
      break;
    case 'unfeature': {
      const removed = await takeDown(db, replayId, now);
      result =
        removed.length > 0 ? { ok: true } : { ok: false, reason: 'not-public' };
      break;
    }
    case 'anonymise':
      result = await anonymise(db, replayId);
      break;
  }
  await db.doc(`adminAudit/${commandId}`).set({
    at: Timestamp.fromMillis(now),
    by: uid,
    type: `replay.${type}`,
    target: { replayId },
    reason: null,
    before: { publicIds: before },
    after: { publicIds: await publicIdsOf(db, replayId) },
    ok: result.ok,
    source: 'replayCommand',
    expireAt: Timestamp.fromMillis(now + AUDIT_YEARS * 365 * DAY_MS),
  });
  return result;
}

async function feature(
  db: Firestore,
  engine: Engine,
  replayId: string,
  now: number
): Promise<ReplayCommandResult> {
  const replay = (await db.doc(`replays/${replayId}`).get()).data() as
    | ReplayDoc
    | undefined;
  if (replay === undefined) {
    return { ok: false, reason: 'no-replay' };
  }
  if (replay.optOut.length > 0) {
    return { ok: false, reason: 'opted-out' };
  }
  const verified = await verifyStored(
    db,
    engine,
    replayId,
    fixedPool('admin'),
    minuteTicks(engine, MAX_GALLERY_MINUTES),
    undefined,
    now
  );
  if (typeof verified === 'string') {
    return { ok: false, reason: verified };
  }
  if (verified.state !== 'verified') {
    return { ok: false, reason: verified.state };
  }
  const published = await publishReplay(db, engine, replayId, 'admin', now);
  return typeof published === 'string'
    ? { ok: false, reason: published }
    : { ok: true, publicId: published.publicId };
}

/** Every name in the replay's public copies falls back to the colour label. */
async function anonymise(
  db: Firestore,
  replayId: string
): Promise<ReplayCommandResult> {
  const published = await livePublicCopies(db, replayId);
  if (published.length === 0) {
    return { ok: false, reason: 'not-public' };
  }
  const batch = db.batch();
  for (const doc of published) {
    const players = (doc.get('players') as { name: string | null }[]).map(
      (player) => ({ ...player, name: null })
    );
    batch.update(doc.ref, { players, anonymised: true });
  }
  await batch.commit();
  return { ok: true };
}

async function livePublicCopies(db: Firestore, replayId: string) {
  return (
    await db
      .collection('publicReplays')
      .where('replayId', '==', replayId)
      .where('removedAt', '==', null)
      .get()
  ).docs;
}

async function publicIdsOf(db: Firestore, replayId: string): Promise<string[]> {
  return (await livePublicCopies(db, replayId)).map((doc) => doc.id);
}
