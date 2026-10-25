import {
  type AdminCommand,
  type EntryTarget,
  parseAdminCommand,
  parseBoardId,
  type PlayerTarget,
} from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { banPlayer, type BanChange, liftBan } from './bans';
import type { Realtime } from './realtime';
import { writeAudit } from './records';

/** What the server made of a command, written back on it as `result`. */
export interface AdminResult {
  ok: boolean;
  /** Why not - an id, never a text to show. */
  error?: string;
}

/** What `adminCommand` needs besides Firestore. */
export interface AdminContext {
  /** Whether the uid is the owner now, read afresh from Auth. */
  isOwner(uid: string): Promise<boolean>;
  realtime: Realtime;
}

/** The parts of an Auth user the owner check reads. */
export interface OwnerRecord {
  customClaims?: Record<string, unknown>;
  emailVerified: boolean;
  providerData: readonly { providerId: string }[];
}

/**
 * The owner as the rules' `isAdmin()` sees them (ADR 0011, 0012): the
 * `admin` claim, a verified email and a Google provider - re-read from
 * Auth, so a revoked claim stops at once rather than when the token ends.
 */
export function isOwnerRecord(user: OwnerRecord): boolean {
  return (
    user.customClaims?.['admin'] === true &&
    user.emailVerified &&
    user.providerData.some((p) => p.providerId === 'google.com')
  );
}

/**
 * Runs `adminCommands/{id}` (ADR 0012), in order:
 * 1. checks the admin: the writer (`authId`, from the auth-context
 *    trigger) is the command's `uid`, and is the owner now;
 * 2. runs the action - once: the command id is the audit id, and a command
 *    already audited only answers again;
 * 3. writes `adminAudit/{commandId}` with `before` and `after`, also for
 *    an action that failed;
 * 4. writes `result: { ok, error?, at }` back on the command.
 * A command that is not exactly one (`parseAdminCommand`) answers
 * `malformed`; one from anybody but the owner `not-writer` or `not-admin`
 * - neither is audited. Only `player.ban` and `player.unban` run so far;
 * every other type answers `unsupported` until its wave.
 */
export async function runAdminCommand(
  db: Firestore,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  context: AdminContext,
  now: number = Date.now()
): Promise<AdminResult> {
  let result: AdminResult;
  try {
    result = await run(db, commandId, data, authId, context, now);
  } catch (error) {
    // Retries are off: the owner still gets an answer, and may send the
    // command again.
    logger.error('Admin command failed', { commandId, error });
    result = { ok: false, error: 'internal' };
  }
  await db.doc(`adminCommands/${commandId}`).update({
    result: { ...result, at: FieldValue.serverTimestamp() },
  });
  return result;
}

/** What an action did, for the audit. */
interface Outcome extends BanChange {
  ok: boolean;
  error?: string;
  /** The target, with the player's uid once it was found. */
  target: Record<string, unknown> | null;
}

async function run(
  db: Firestore,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  context: AdminContext,
  now: number
): Promise<AdminResult> {
  const uid = data['uid'];
  if (typeof uid !== 'string' || authId !== uid) {
    return { ok: false, error: 'not-writer' };
  }
  if (!(await context.isOwner(uid))) {
    return { ok: false, error: 'not-admin' };
  }
  const command = parseAdminCommand(data);
  if (command === null) {
    return { ok: false, error: 'malformed' };
  }
  const audited = await db.doc(`adminAudit/${commandId}`).get();
  if (audited.exists) {
    return answer(audited.get('ok') === true, audited.get('error'));
  }
  let outcome: Outcome;
  try {
    outcome = await act(db, commandId, command, context, now);
  } catch (error) {
    // Audited as failed, with what is known: the action may have run in
    // part, and the owner sees that in the audit.
    logger.error('Admin action failed', { commandId, error });
    outcome = {
      ok: false,
      error: 'internal',
      target: command.target === null ? null : { ...command.target },
      before: null,
      after: null,
    };
  }
  await writeAudit(
    db,
    commandId,
    {
      by: uid,
      type: command.type,
      target: outcome.target,
      reason: command.reason,
      before: outcome.before,
      after: outcome.after,
      ok: outcome.ok,
      ...(outcome.error === undefined ? {} : { error: outcome.error }),
      source: 'adminCommand',
    },
    now
  );
  return answer(outcome.ok, outcome.error);
}

function answer(ok: boolean, error: unknown): AdminResult {
  return ok || typeof error !== 'string' ? { ok } : { ok, error };
}

async function act(
  db: Firestore,
  commandId: string,
  command: AdminCommand,
  context: AdminContext,
  now: number
): Promise<Outcome> {
  const unchanged = { before: null, after: null };
  if (command.type !== 'player.ban' && command.type !== 'player.unban') {
    return {
      ok: false,
      error: 'unsupported',
      target: command.target === null ? null : { ...command.target },
      ...unchanged,
    };
  }
  const uid = await targetUid(db, command.target);
  const target = { ...command.target, ...(uid === null ? {} : { uid }) };
  if (uid === null) {
    return { ok: false, error: 'not-found', target, ...unchanged };
  }
  if (command.type === 'player.unban') {
    const change = await liftBan(db, context.realtime, uid, commandId, now);
    return change === null
      ? { ok: false, error: 'not-banned', target, ...unchanged }
      : { ok: true, target, ...change };
  }
  const { until, reason } = command.args;
  if (until !== null && until <= now) {
    return { ok: false, error: 'ended', target, ...unchanged };
  }
  const change = await banPlayer(
    db,
    context.realtime,
    uid,
    until,
    reason,
    commandId,
    now
  );
  return { ok: true, target, ...change };
}

/**
 * The player a target names: its uid, or the player behind a board entry,
 * found through `boardMembers` (`entryIds.<kind>`) - null when nobody
 * holds that entry.
 */
async function targetUid(
  db: Firestore,
  target: PlayerTarget | EntryTarget
): Promise<string | null> {
  if ('uid' in target) {
    return target.uid;
  }
  // The parser let only a real board id through.
  const board = parseBoardId(target.boardId);
  if (board === null) {
    return null;
  }
  const member = await db
    .collection('boardMembers')
    .where(`entryIds.${board.kind}`, '==', target.entryId)
    .limit(1)
    .get();
  return member.docs[0]?.id ?? null;
}
