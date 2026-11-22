import type { CommandResult } from '@wolsok/feat-shared-bacteria-engine/cloud';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { ignoreNotFound } from '../grpc';

/**
 * Runs a command document (`adminCommands/{id}`, `replayCommands/{id}`,
 * ADR 0011, 0012) and writes its result back on it, in order:
 * 1. checks the writer: `authId` (from the auth-context trigger) must be
 *    the command's `uid`, so nobody acts in another's name - `not-writer`
 *    otherwise, without running anything;
 * 2. runs `run` for that uid; a throw answers `internal`, so the writer
 *    still gets an answer and may send it again;
 * 3. writes `result: { ok, error?, at }` back, with the `fields` `alsoWrite`
 *    gives at that moment - unless `run` answered null, where another
 *    delivery runs the command and writes it;
 * 4. throws a failure of `run` on once its result is written, so the
 *    handler's `withSentry` reports it (#3213). Safe only because the
 *    command triggers run without retries (`main.spec.ts` keeps them so):
 *    a retry would run the command twice.
 * A command deleted meanwhile (its player's account deletion, ADR 0012)
 * gets no result: nobody is left to read it.
 */
export async function runCommandDocument(
  db: Firestore,
  path: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  run: (uid: string) => Promise<CommandResult | null>,
  alsoWrite: () => Record<string, unknown> = () => ({})
): Promise<CommandResult | null> {
  const uid = data['uid'];
  if (typeof uid !== 'string' || authId !== uid) {
    return answer(db, path, { ok: false, error: 'not-writer' }, alsoWrite);
  }
  let result: CommandResult | null;
  try {
    result = await run(uid);
  } catch (error) {
    logger.error('Command failed', { path, error });
    // The command's error goes on, even if its answer cannot be written.
    await answer(db, path, { ok: false, error: 'internal' }, alsoWrite).catch(
      (writeError: unknown) =>
        logger.error('Could not answer a failed command', {
          path,
          error: writeError,
        })
    );
    throw error;
  }
  return answer(db, path, result, alsoWrite);
}

/** Writes the result back, if any, and returns it. */
async function answer(
  db: Firestore,
  path: string,
  result: CommandResult | null,
  alsoWrite: () => Record<string, unknown>
): Promise<CommandResult | null> {
  if (result !== null) {
    await writeResult(db, path, result, alsoWrite());
  }
  return result;
}

async function writeResult(
  db: Firestore,
  path: string,
  result: CommandResult,
  fields: Record<string, unknown>
): Promise<void> {
  await db
    .doc(path)
    .update({
      ...fields,
      result: { ...result, at: FieldValue.serverTimestamp() },
    })
    .catch(ignoreNotFound);
}
