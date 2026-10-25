import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import type { ModerationChange } from '../admin/moderation';
import { runAudited } from '../admin/records';
import type { Verdict } from '../boards/verify';
import {
  anonymiseReplay,
  featureReplay,
  unfeatureReplay,
} from '../gallery/curate';
import { removeFromGallery } from '../gallery/publish';
import { isBanned } from '../limits';

/** What a command asks; all but `remove` are the owner's (ADR 0011). */
export type ReplayCommandType =
  | 'remove'
  | 'feature'
  | 'unfeature'
  | 'anonymise';

/** What the server made of a command, written back on it. */
export interface CommandResult {
  ok: boolean;
  /** Why not - an id, never a text to show. */
  reason?: string;
}

/** What `replayCommand` needs besides Firestore. */
export interface ReplayCommandContext {
  /** Whether the uid is the owner now, read afresh from Auth. */
  isOwner(uid: string): Promise<boolean>;
  /** For the specs: the clock and the re-run `feature` may need. */
  clock?: () => number;
  verify?: (replay: Replay) => Verdict;
}

const TYPES: readonly ReplayCommandType[] = [
  'remove',
  'feature',
  'unfeature',
  'anonymise',
];

/**
 * Runs `replayCommands/{id}` and writes its result back on it. The writer
 * must be the command's `uid` (`authId`, from the auth-context trigger),
 * so nobody acts in another player's name.
 * - `remove`: keeps the replay out of the gallery for good - the player goes
 *   into its `optOut` - and takes down a public copy, if there is one.
 * - `feature`, `unfeature`, `anonymise`: the owner's curation
 *   (`gallery/curate.ts`), for the owner as `isOwner` reads them now, and
 *   audited like an admin command (ADR 0012, `source: 'replayCommand'`,
 *   `runAudited`): a second delivery runs nothing and leaves the first
 *   one's result.
 * Null where another delivery runs it and writes the result.
 */
export async function runReplayCommand(
  db: Firestore,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  context: ReplayCommandContext,
  now: number = Date.now()
): Promise<CommandResult | null> {
  let result: CommandResult | null;
  try {
    result = await run(db, commandId, data, authId, context, now);
  } catch (error) {
    // Retries are off: the writer still gets an answer, and may send the
    // command again - `remove` is idempotent.
    logger.error('Replay command failed', { commandId, error });
    result = { ok: false, reason: 'internal' };
  }
  if (result !== null) {
    await db.doc(`replayCommands/${commandId}`).update({
      result: { ...result, at: FieldValue.serverTimestamp() },
    });
  }
  return result;
}

async function run(
  db: Firestore,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  context: ReplayCommandContext,
  now: number
): Promise<CommandResult | null> {
  const { uid, type, replayId } = data;
  if (
    typeof uid !== 'string' ||
    typeof replayId !== 'string' ||
    !TYPES.includes(type as ReplayCommandType)
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (authId !== uid) {
    return { ok: false, reason: 'not-writer' };
  }
  if (type !== 'remove') {
    if (!(await context.isOwner(uid))) {
      return { ok: false, reason: 'not-admin' };
    }
    return curate(
      db,
      commandId,
      uid,
      type as Exclude<ReplayCommandType, 'remove'>,
      replayId,
      context,
      now
    );
  }
  if (await isBanned(db, uid, now)) {
    return { ok: false, reason: 'banned' };
  }
  const ref = db.doc(`replays/${replayId}`);
  const replay = await ref.get();
  const players = replay.get('players');
  if (!replay.exists || !Array.isArray(players) || !players.includes(uid)) {
    return { ok: false, reason: 'not-found' };
  }
  // `galleryOut` keeps it out once the player is gone from `optOut` too.
  await removeFromGallery(db, replayId, uid, now);
  return { ok: true };
}

/** The owner's curation, audited once per command (`runAudited`). */
async function curate(
  db: Firestore,
  commandId: string,
  uid: string,
  type: Exclude<ReplayCommandType, 'remove'>,
  replayId: string,
  context: ReplayCommandContext,
  now: number
): Promise<CommandResult | null> {
  const act = async (): Promise<ModerationChange | string> => {
    switch (type) {
      case 'feature':
        return featureReplay(db, replayId, now, context.clock, context.verify);
      case 'unfeature':
        return unfeatureReplay(db, replayId, now);
      case 'anonymise':
        return anonymiseReplay(db, replayId);
    }
  };
  const result = await runAudited(
    db,
    commandId,
    {
      by: uid,
      type: `replay.${type}`,
      target: { replayId },
      reason: '',
      source: 'replayCommand',
    },
    async () => ({ change: await act() }),
    now
  );
  return result === null || result.error === undefined
    ? result
    : { ok: result.ok, reason: result.error };
}
