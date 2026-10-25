import {
  type AdminCommand,
  type EntryTarget,
  parseAdminCommand,
  parseBoardId,
  type PlayerTarget,
} from '@wolsok/feat-lazy-bac-game/engine';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { banPlayer, liftBan } from './bans';
import {
  moderateBoards,
  moderateProfile,
  type ModerationChange,
} from './moderation';
import { verifyNow } from '../boards/verify-now';
import type { Realtime } from './realtime';
import { type RemoteToggles, setToggles } from './toggles';
import { recountAccounts, refreshStats } from './stats';
import { googleProviderOf } from './tombstones';
import { type AuditedAction, runAudited } from './records';

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
  /** The account's ban tombstone id, null without a Google provider. */
  tombstoneOf(uid: string): Promise<string | null>;
  /** The feature toggles in Remote Config. */
  toggles: RemoteToggles;
  /** The uids of every account Auth holds, for `stats.recount`. */
  accountUids(): Promise<readonly string[]>;
}

/** The parts of an Auth user the owner check reads. */
export interface OwnerRecord {
  customClaims?: Record<string, unknown>;
  emailVerified: boolean;
  disabled: boolean;
  providerData: readonly { providerId: string }[];
}

/**
 * The owner as the rules' `isAdmin()` sees them (ADR 0011, 0012): the
 * `admin` claim, a verified email and a Google provider, on an account
 * that is not disabled - re-read from Auth, so a revoked claim or a
 * disabled account stops at once rather than when the token ends. (The
 * trigger sees no token, so revoked refresh tokens alone wait for it.)
 */
export function isOwnerRecord(user: OwnerRecord): boolean {
  return (
    user.customClaims?.['admin'] === true &&
    user.emailVerified &&
    !user.disabled &&
    googleProviderOf(user) !== undefined
  );
}

/**
 * Runs `adminCommands/{id}` (ADR 0012), in order:
 * 1. checks the admin: the writer (`authId`, from the auth-context
 *    trigger) is the command's `uid`, and is the owner now;
 * 2. runs the action once, audited (`runAudited`): a second delivery of
 *    the event neither runs it again nor overwrites the first one's
 *    result;
 * 3. writes `result: { ok, error?, at }` back on the command.
 * A command that is not exactly one (`parseAdminCommand`) answers
 * `malformed`; one from anybody but the owner `not-writer` or `not-admin`
 * - neither is audited. Every type runs: `bans.ts`, `moderation.ts`,
 * `stats.ts`, `toggles.ts` and the boards' `verify-now.ts`.
 */
export async function runAdminCommand(
  db: Firestore,
  commandId: string,
  data: Record<string, unknown>,
  authId: string | undefined,
  context: AdminContext,
  now: number = Date.now()
): Promise<AdminResult | null> {
  let result: AdminResult | null;
  try {
    result = await run(db, commandId, data, authId, context, now);
  } catch (error) {
    // Retries are off: the owner still gets an answer, and may send the
    // command again.
    logger.error('Admin command failed', { commandId, error });
    result = { ok: false, error: 'internal' };
  }
  // Null: another delivery runs it, and writes the result.
  if (result !== null) {
    await db.doc(`adminCommands/${commandId}`).update({
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
  context: AdminContext,
  now: number
): Promise<AdminResult | null> {
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
  return runAudited(
    db,
    commandId,
    {
      by: uid,
      type: command.type,
      target: command.target === null ? null : { ...command.target },
      reason: command.reason,
      source: 'adminCommand',
    },
    () => act(db, commandId, command, context, now),
    now
  );
}

async function act(
  db: Firestore,
  commandId: string,
  command: AdminCommand,
  context: AdminContext,
  now: number
): Promise<AuditedAction> {
  switch (command.type) {
    case 'stats.refresh':
      return {
        target: null,
        change: {
          before: null,
          after: await refreshStats(db, context.realtime, now),
        },
      };
    case 'stats.recount': {
      const { before, after } = await recountAccounts(db, () =>
        context.accountUids()
      );
      return { target: null, change: { before, after } };
    }
  }
  if (command.type === 'toggles.set') {
    return {
      target: null,
      change: await setToggles(context.toggles, command.args.values),
    };
  }
  const uid = await targetUid(db, command.target);
  const target = { ...command.target, ...(uid === null ? {} : { uid }) };
  if (uid === null) {
    return { target, change: 'not-found' };
  }
  const done = (change: ModerationChange | string) => ({ target, change });
  switch (command.type) {
    case 'profile.reset':
    case 'profile.removeImage':
      return done(
        await moderateProfile(
          db,
          uid,
          command.type === 'profile.reset' ? 'reset' : 'removeImage',
          commandId,
          now
        )
      );
    case 'board.hideEntry':
    case 'board.hidePlayer':
    case 'board.restore': {
      const hide = command.type !== 'board.restore';
      return done(
        await moderateBoards(
          db,
          uid,
          command.type === 'board.hidePlayer' || 'uid' in command.target
            ? 'all'
            : command.target,
          { hide, bar: hide && command.args.bar === true },
          commandId,
          now
        )
      );
    }
    case 'board.verify': {
      const board = parseBoardId(command.target.boardId);
      // The parser lets only daily and endless boards through.
      if (board?.kind !== 'daily' && board?.kind !== 'endless') {
        return done('malformed');
      }
      const result = await verifyNow(
        db,
        uid,
        board.kind === 'daily' ? board : { kind: 'endless' },
        now
      );
      return done(
        typeof result === 'string' ? result : { before: null, after: result }
      );
    }
    case 'player.unban':
      return done(
        await liftBan(db, context.realtime, uid, commandId, now, {
          tombstone: await context.tombstoneOf(uid),
        })
      );
    case 'player.ban': {
      const { until, reason } = command.args;
      if (until !== null && until <= now) {
        return done('ended');
      }
      return done(
        await banPlayer(
          db,
          context.realtime,
          uid,
          until,
          reason,
          commandId,
          now,
          { tombstone: await context.tombstoneOf(uid) }
        )
      );
    }
  }
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
