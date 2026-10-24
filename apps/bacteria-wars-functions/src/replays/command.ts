import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
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
 * - `feature`, `unfeature`, `anonymise` come with the gallery and the admin
 *   area (ADR 0011 step 6, ADR 0012); until then they answer `unsupported`.
 */
export async function runReplayCommand(
  db: Firestore,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  now: number = Date.now()
): Promise<CommandResult> {
  let result: CommandResult;
  try {
    result = await run(db, data, authId, now);
  } catch (error) {
    // Retries are off: the writer still gets an answer, and may send the
    // command again - `remove` is idempotent.
    logger.error('Replay command failed', { commandId, error });
    result = { ok: false, reason: 'internal' };
  }
  await db.doc(`replayCommands/${commandId}`).update({
    result: { ...result, at: FieldValue.serverTimestamp() },
  });
  return result;
}

async function run(
  db: Firestore,
  data: Record<string, unknown>,
  authId: string | undefined,
  now: number
): Promise<CommandResult> {
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
    return { ok: false, reason: 'unsupported' };
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
  await ref.update({ optOut: FieldValue.arrayUnion(uid) });
  const published = await db
    .collection('publicReplays')
    .where('replayId', '==', replayId)
    .where('removedAt', '==', null)
    .get();
  await Promise.all(
    published.docs.map((doc) =>
      doc.ref.update({ removedAt: FieldValue.serverTimestamp() })
    )
  );
  return { ok: true };
}
