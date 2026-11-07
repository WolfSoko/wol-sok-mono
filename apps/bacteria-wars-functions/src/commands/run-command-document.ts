import type { CommandResult } from '@wolsok/feat-shared-bacteria-engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { hasGrpcCode } from '../grpc';

/**
 * Runs a command document (`adminCommands/{id}`, `replayCommands/{id}`,
 * ADR 0011, 0012) and writes its result back on it, in order:
 * 1. checks the writer: `authId` (from the auth-context trigger) must be
 *    the command's `uid`, so nobody acts in another's name - `not-writer`
 *    otherwise, without running anything;
 * 2. runs `run` for that uid; a throw answers `internal` (retries are
 *    off, so the writer still gets an answer and may send it again);
 * 3. writes `result: { ok, error?, at }` back - unless `run` answered
 *    null, where another delivery runs the command and writes it.
 * A command deleted meanwhile (its player's account deletion, ADR 0012)
 * gets no result: nobody is left to read it.
 */
export async function runCommandDocument(
  db: Firestore,
  path: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  run: (uid: string) => Promise<CommandResult | null>
): Promise<CommandResult | null> {
  const uid = data['uid'];
  let result: CommandResult | null;
  if (typeof uid !== 'string' || authId !== uid) {
    result = { ok: false, error: 'not-writer' };
  } else {
    try {
      result = await run(uid);
    } catch (error) {
      logger.error('Command failed', { path, error });
      result = { ok: false, error: 'internal' };
    }
  }
  if (result !== null) {
    await writeResult(db, path, result);
  }
  return result;
}

async function writeResult(
  db: Firestore,
  path: string,
  result: CommandResult
): Promise<void> {
  try {
    await db
      .doc(path)
      .update({ result: { ...result, at: FieldValue.serverTimestamp() } });
  } catch (error) {
    if (!hasGrpcCode(error, 5, 'not-found')) {
      throw error;
    }
  }
}
