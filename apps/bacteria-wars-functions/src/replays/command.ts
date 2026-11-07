import {
  type CommandResult,
  type CurationCommandType,
  isCurationCommandType,
  parseReplayCommand,
  type Replay,
} from '@wolsok/feat-shared-bacteria-engine';
import type { Firestore } from 'firebase-admin/firestore';
import type { ModerationChange } from '../admin/moderation';
import { runAudited } from '../admin/records';
import type { Verdict } from '../boards/verify';
import { runCommandDocument } from '../commands/run-command-document';
import {
  anonymiseReplay,
  featureReplay,
  unfeatureReplay,
} from '../gallery/curate';
import { removeFromGallery } from '../gallery/publish';
import { isBanned } from '../limits';
import { forgetForPlayer } from './forget';

/** What `replayCommand` needs besides Firestore. */
export interface ReplayCommandContext {
  /** Whether the uid is the owner now, read afresh from Auth. */
  isOwner(uid: string): Promise<boolean>;
  /** For the specs: the clock and the re-run `feature` may need. */
  clock?: () => number;
  verify?: (replay: Replay) => Verdict;
}

/**
 * Runs `replayCommands/{id}` through `runCommandDocument`, which checks
 * that the writer is the command's `uid`, catches and writes the result
 * back. A command that is not exactly one (`parseReplayCommand`) answers
 * `malformed`.
 * - `remove`: keeps the replay out of the gallery for good - the player goes
 *   into its `optOut` - and takes down a public copy, if there is one.
 * - `forget` (ADR 0012, owner's decision of 2026-10-26): takes the player
 *   out of the replay and its public copies (`forgetForPlayer`); the
 *   replay stays anonymised for the statistics. Also for a banned player, like
 *   every deletion: it is how they delete a match in the cloud. Claimed in
 *   its transaction, so a second delivery runs nothing.
 * - `feature`, `unfeature`, `anonymise`: the owner's curation
 *   (`gallery/curate.ts`), for the owner as `isOwner` reads them now, and
 *   audited like an admin command (ADR 0012, `source: 'replayCommand'`,
 *   `runAudited`): a second delivery runs nothing and leaves the first
 *   one's result.
 * Null where another delivery runs it and writes the result.
 */
export function runReplayCommand(
  db: Firestore,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  context: ReplayCommandContext,
  now: number = Date.now()
): Promise<CommandResult | null> {
  return runCommandDocument(
    db,
    `replayCommands/${commandId}`,
    data,
    authId,
    (uid) => run(db, commandId, uid, data, context, now)
  );
}

async function run(
  db: Firestore,
  commandId: string,
  uid: string,
  data: Record<string, unknown>,
  context: ReplayCommandContext,
  now: number
): Promise<CommandResult | null> {
  const command = parseReplayCommand(data);
  if (command === null) {
    return { ok: false, error: 'malformed' };
  }
  const { type, replayId } = command;
  if (isCurationCommandType(type)) {
    if (!(await context.isOwner(uid))) {
      return { ok: false, error: 'not-admin' };
    }
    return curate(db, commandId, uid, type, replayId, context, now);
  }
  switch (type) {
    case 'forget':
      return forgetForPlayer(db, commandId, uid, replayId, now);
    case 'remove':
      return removeForPlayer(db, uid, replayId, now);
  }
}

/**
 * Keeps a player's replay out of the gallery for good and takes down a
 * public copy - refused while a ban holds.
 */
async function removeForPlayer(
  db: Firestore,
  uid: string,
  replayId: string,
  now: number
): Promise<CommandResult> {
  if (await isBanned(db, uid, now)) {
    return { ok: false, error: 'banned' };
  }
  const replay = await db.doc(`replays/${replayId}`).get();
  const players = replay.get('players');
  if (!replay.exists || !Array.isArray(players) || !players.includes(uid)) {
    return { ok: false, error: 'not-found' };
  }
  // `galleryOut` keeps it out once the player is gone from `optOut` too.
  await removeFromGallery(db, replayId, uid, now);
  return { ok: true };
}

/** The owner's curation, audited once per command (`runAudited`). */
function curate(
  db: Firestore,
  commandId: string,
  uid: string,
  type: CurationCommandType,
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
  return runAudited(
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
}
