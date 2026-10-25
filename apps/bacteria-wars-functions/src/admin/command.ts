import { parseBoardId } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { BAN_REASONS, type BanReason, banPlayer, unbanPlayer } from './bans';
import type { AdminDeps } from './deps';
import { setHidden } from './hide';
import { writeAudit, writeNotice } from './notices';
import { moderateProfile } from './profile';
import { recountAccounts, refreshStats } from './stats';

/** The owner's commands (ADR 0012) - the rules allow these types only. */
export const ADMIN_COMMANDS = [
  'profile.reset',
  'profile.removeImage',
  'board.hideEntry',
  'board.hidePlayer',
  'board.restore',
  'board.verify',
  'player.ban',
  'player.unban',
  'stats.refresh',
  'stats.recount',
] as const;
export type AdminCommandType = (typeof ADMIN_COMMANDS)[number];

/** What a command came to, written back on it - `error` is an id. */
export interface AdminResult {
  ok: boolean;
  error?: string;
}

/** The outcome of an action: what the audit records. */
interface Done {
  target: Record<string, unknown>;
  before: unknown;
  after: unknown;
}

class CommandError extends Error {}
const refuse = (error: string): never => {
  throw new CommandError(error);
};

/**
 * Runs `adminCommands/{id}` (ADR 0012): checks that the writer is the
 * command's `uid` and, read afresh from Auth, still the owner - a revoked
 * claim stops at once; runs the action; writes `adminAudit/{id}` (the
 * command id is the audit id, so a repeat runs nothing); and writes the
 * result back on the command, which the admin view watches.
 */
export async function runAdminCommand(
  db: Firestore,
  deps: AdminDeps,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  now: number = Date.now()
): Promise<AdminResult> {
  let result: AdminResult;
  try {
    result = await run(db, deps, commandId, data, authId, now);
  } catch (error) {
    if (error instanceof CommandError) {
      result = { ok: false, error: error.message };
    } else {
      logger.error('Admin command failed', { commandId, error });
      result = { ok: false, error: 'internal' };
    }
  }
  await db.doc(`adminCommands/${commandId}`).update({
    result: { ...result, at: FieldValue.serverTimestamp() },
  });
  return result;
}

async function run(
  db: Firestore,
  deps: AdminDeps,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  now: number
): Promise<AdminResult> {
  const { uid, type, reason } = data;
  if (
    typeof uid !== 'string' ||
    !ADMIN_COMMANDS.includes(type as AdminCommandType)
  ) {
    return refuse('malformed');
  }
  if (authId !== uid) {
    return refuse('not-writer');
  }
  if ((await deps.account(uid))?.admin !== true) {
    return refuse('not-admin');
  }
  if ((await db.doc(`adminAudit/${commandId}`).get()).exists) {
    return { ok: true };
  }
  const command = type as AdminCommandType;
  const done = await act(db, deps, commandId, command, data, now);
  await writeAudit(
    db,
    commandId,
    {
      by: uid,
      type: command,
      target: done.target,
      reason: typeof reason === 'string' ? reason : '',
      before: done.before ?? null,
      after: done.after ?? null,
      ok: true,
      source: 'adminCommand',
    },
    now
  );
  return { ok: true };
}

async function act(
  db: Firestore,
  deps: AdminDeps,
  commandId: string,
  type: AdminCommandType,
  data: Record<string, unknown>,
  now: number
): Promise<Done> {
  const target = (data['target'] ?? {}) as Record<string, unknown>;
  const args = (data['args'] ?? {}) as Record<string, unknown>;
  const bar = args['bar'] === true;
  switch (type) {
    case 'profile.reset':
    case 'profile.removeImage': {
      const uid = await targetUid(db, target);
      const action = type === 'profile.reset' ? 'reset' : 'removeImage';
      const change =
        (await moderateProfile(db, uid, action)) ?? refuse('no-profile');
      await writeNotice(
        db,
        uid,
        commandId,
        { type: action === 'reset' ? 'profile-reset' : 'image-removed' },
        now
      );
      return { target: { uid }, ...change };
    }
    case 'board.hideEntry':
    case 'board.hidePlayer':
    case 'board.restore': {
      const uid = await targetUid(db, target);
      const one =
        type === 'board.hideEntry' ||
        (type === 'board.restore' && typeof target['boardId'] === 'string');
      const boardIds = one ? [String(target['boardId'])] : undefined;
      const hide = type !== 'board.restore';
      const changes = await setHidden(db, uid, 'admin', hide, {
        boardIds,
        bar,
      });
      if (hide) {
        await Promise.all([
          writeNotice(db, uid, commandId, { type: 'board-hidden' }, now),
          db
            .doc(`moderation/${uid}`)
            .set({ hides: FieldValue.increment(1) }, { merge: true }),
        ]);
      }
      return {
        target: { uid, ...(boardIds ? { boardId: boardIds[0] } : {}) },
        before: changes.map(({ boardId, before }) => ({ boardId, before })),
        after: { entries: changes, bar },
      };
    }
    case 'player.ban': {
      const uid = await targetUid(db, target);
      const until = args['until'];
      const banReason = args['reason'];
      if (
        !(until === null || until instanceof Timestamp) ||
        !BAN_REASONS.includes(banReason as BanReason)
      ) {
        return refuse('malformed');
      }
      const change = await banPlayer(
        db,
        deps,
        uid,
        until === null ? null : until.toMillis(),
        banReason as BanReason,
        now,
        commandId
      );
      return { target: { uid }, ...change };
    }
    case 'player.unban': {
      const uid = await targetUid(db, target);
      if (!(await unbanPlayer(db, deps, uid, now, commandId))) {
        return refuse('not-banned');
      }
      return { target: { uid }, before: { banned: true }, after: null };
    }
    case 'stats.refresh':
      return {
        target: {},
        before: null,
        after: await refreshStats(db, deps, now),
      };
    case 'stats.recount':
      return {
        target: {},
        before: null,
        after: { accounts: await recountAccounts(db, deps) },
      };
    case 'board.verify':
      // Comes with the admin area's leaderboard view; the hourly slice
      // verifies meanwhile.
      return refuse('unsupported');
  }
}

/**
 * The player a command is about: `target.uid`, or the owner of
 * `target.entryId` on `target.boardId` (looked up in `boardMembers`).
 */
async function targetUid(
  db: Firestore,
  target: Record<string, unknown>
): Promise<string> {
  if (typeof target['uid'] === 'string' && target['uid'] !== '') {
    return target['uid'];
  }
  const board =
    typeof target['boardId'] === 'string'
      ? parseBoardId(target['boardId'])
      : null;
  const entryId = target['entryId'];
  if (board === null || typeof entryId !== 'string') {
    return refuse('no-target');
  }
  const member = await db
    .collection('boardMembers')
    .where(`entryIds.${board.kind}`, '==', entryId)
    .limit(1)
    .get();
  return member.docs[0]?.id ?? refuse('no-target');
}
