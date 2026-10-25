import {
  type AdminCommand,
  type EntryTarget,
  isUid,
  parseAdminCommand,
  parseBoardId,
  type PlayerTarget,
} from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { banPlayer, unbanPlayer } from './bans';
import type { AdminDeps } from './deps';
import { setHidden } from './hide';
import {
  bumpModeration,
  claimAudit,
  type NoticeType,
  settleAudit,
  writeNotice,
} from './notices';
import { moderateProfile } from './profile';
import { recountAccounts, refreshStats } from './stats';

/** What a command came to, written back on it - `error` is an id. */
export interface AdminResult {
  ok: boolean;
  error?: string;
}

/** The outcome of an action: what the audit records. */
interface Done {
  before: unknown;
  after: unknown;
}

class CommandError extends Error {}
const refuse = (error: string): never => {
  throw new CommandError(error);
};

/** What each profile command does, and what the player is told. */
const PROFILE_ACTIONS = {
  'profile.reset': { action: 'reset', notice: 'profile-reset' },
  'profile.removeImage': { action: 'removeImage', notice: 'image-removed' },
} as const satisfies Record<
  string,
  { action: 'reset' | 'removeImage'; notice: NoticeType }
>;

/**
 * Runs `adminCommands/{id}` (ADR 0012): reads it with the engine's
 * `parseAdminCommand` (the parser the admin view checks it with); checks
 * that the writer is the command's `uid` and, read afresh from Auth, still
 * the owner - a revoked claim stops at once; claims `adminAudit/{id}`
 * (the command id is the audit id, so a second delivery runs nothing);
 * runs the action; settles the audit; and writes the result back on the
 * command, which the admin view watches.
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
    if (!(error instanceof CommandError)) {
      logger.error('Admin command failed', { commandId, error });
    }
    result = {
      ok: false,
      error: error instanceof CommandError ? error.message : 'internal',
    };
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
  const uid = data['uid'];
  const command = parseAdminCommand(data);
  if (!isUid(uid) || command === null) {
    return refuse('malformed');
  }
  if (authId !== uid) {
    return refuse('not-writer');
  }
  if ((await deps.account(uid))?.admin !== true) {
    return refuse('not-admin');
  }
  const claim = {
    by: uid,
    type: command.type,
    target: command.target as Record<string, unknown> | null,
    reason: command.reason,
    source: 'adminCommand' as const,
  };
  if (!(await claimAudit(db, commandId, claim, now))) {
    return { ok: true };
  }
  try {
    const done = await act(db, deps, commandId, command, now);
    await settleAudit(db, commandId, { ok: true, ...done });
    return { ok: true };
  } catch (error) {
    await settleAudit(db, commandId, {
      ok: false,
      error: error instanceof CommandError ? error.message : 'internal',
    });
    throw error;
  }
}

async function act(
  db: Firestore,
  deps: AdminDeps,
  commandId: string,
  command: AdminCommand,
  now: number
): Promise<Done> {
  switch (command.type) {
    case 'profile.reset':
    case 'profile.removeImage': {
      const { action, notice } = PROFILE_ACTIONS[command.type];
      const uid = command.target.uid;
      const change =
        (await moderateProfile(db, uid, action)) ?? refuse('no-profile');
      await writeNotice(db, uid, commandId, { type: notice }, now);
      return change;
    }
    case 'board.hideEntry':
    case 'board.hidePlayer':
    case 'board.restore': {
      const uid = await targetUid(db, command.target);
      // hidePlayer works on every board; the others on the target's board.
      const boardIds =
        command.type !== 'board.hidePlayer' && 'boardId' in command.target
          ? [command.target.boardId]
          : undefined;
      const hide = command.type !== 'board.restore';
      const bar = 'bar' in command.args && command.args.bar === true;
      const changes = await setHidden(db, uid, 'admin', hide, {
        boardIds,
        bar,
      });
      if (hide) {
        await Promise.all([
          writeNotice(db, uid, commandId, { type: 'board-hidden' }, now),
          bumpModeration(db, uid, 'hides'),
        ]);
      }
      return { before: null, after: { uid, entries: changes, bar } };
    }
    case 'player.ban': {
      const { until, reason } = command.args;
      if (until !== null && until <= now) {
        return refuse('ended');
      }
      const uid = await targetUid(db, command.target);
      return banPlayer(db, deps, uid, until, reason, now, commandId);
    }
    case 'player.unban': {
      const uid = command.target.uid;
      if (!(await unbanPlayer(db, deps, uid, now, commandId))) {
        return refuse('not-banned');
      }
      return { before: { banned: true }, after: null };
    }
    case 'stats.refresh':
      return { before: null, after: await refreshStats(db, deps, now) };
    case 'stats.recount':
      return {
        before: null,
        after: { accounts: await recountAccounts(db, deps) },
      };
    case 'board.verify':
      // Comes with the admin area's leaderboard view; the hourly slices
      // verify meanwhile.
      return refuse('unsupported');
  }
}

/**
 * The player a command is about: the target's uid, or the owner of the
 * target entry (looked up in `boardMembers`).
 */
async function targetUid(
  db: Firestore,
  target: PlayerTarget | EntryTarget
): Promise<string> {
  if ('uid' in target) {
    return target.uid;
  }
  const kind = parseBoardId(target.boardId)?.kind ?? refuse('no-target');
  const member = await db
    .collection('boardMembers')
    .where(`entryIds.${kind}`, '==', target.entryId)
    .limit(1)
    .select()
    .get();
  return member.docs[0]?.id ?? refuse('no-target');
}
