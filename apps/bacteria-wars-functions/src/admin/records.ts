import type { BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { DAY_MS } from '../boards/budgets';
import { hasGrpcCode } from '../grpc';
import type { ModerationChange } from './moderation';

/** How long an audit entry is kept (ADR 0012): 2 years, then TTL. */
export const AUDIT_TTL_MS = 2 * 365 * DAY_MS;

/** How long a ban tombstone is kept at most: 2 years, then TTL. */
export const TOMBSTONE_TTL_MS = 2 * 365 * DAY_MS;

/** How long a player's notice is kept: 31 days, then TTL. */
export const NOTICE_TTL_MS = 31 * DAY_MS;

/** Who acted, as an audit entry tells it. */
export type AuditSource = 'adminCommand' | 'replayCommand' | 'system';

/**
 * `adminAudit/{id}` (ADR 0012): who did what to whom, and what it changed.
 * The id is the command's, so an action is audited once.
 */
export interface AuditEntry {
  /** The owner's uid, or `system` for what a function did by itself. */
  by: string;
  type: string;
  /** The command's target; a player's `uid` is added when it was found. */
  target: Record<string, unknown> | null;
  reason: string;
  before: unknown;
  after: unknown;
  /** Null while the command runs: it claimed the entry, and is not done. */
  ok: boolean | null;
  /** Why not, for a command that failed - an id, never a text to show. */
  error?: string;
  source: AuditSource;
}

/**
 * Writes an audit entry, kept 2 years - false when one with this id is
 * there already, which leaves it as it is.
 */
export async function writeAudit(
  db: Firestore,
  id: string,
  entry: AuditEntry,
  now: number
): Promise<boolean> {
  try {
    await db.doc(`adminAudit/${id}`).create({
      ...entry,
      at: Timestamp.fromMillis(now),
      expireAt: Timestamp.fromMillis(now + AUDIT_TTL_MS),
    });
    return true;
  } catch (error) {
    // Audited before.
    if (hasGrpcCode(error, 6, 'already-exists')) {
      return false;
    }
    throw error;
  }
}

/** What an audited action did, for `runAudited`. */
export interface AuditedAction {
  /** The target as found (with the player's uid), if not the claimed one. */
  target?: Record<string, unknown> | null;
  /** What it changed, or the error it answered - an id. */
  change: ModerationChange | string;
}

/**
 * Runs an owner's command once (ADR 0012), however often its event is
 * delivered:
 * 1. claims `adminAudit/{commandId}` with `head` (`ok: null`) - a second
 *    delivery runs nothing and answers from the audit, null while the
 *    first one still runs;
 * 2. runs `act`, a throw answering `internal`;
 * 3. completes the audit with `before` and `after`, also for an action
 *    that failed, and answers.
 * A command that died between 1 and 3 stays `ok: null`; the owner sends a
 * new one.
 */
export async function runAudited(
  db: Firestore,
  commandId: string,
  head: Omit<AuditEntry, 'before' | 'after' | 'ok' | 'error'>,
  act: () => Promise<AuditedAction>,
  now: number
): Promise<{ ok: boolean; error?: string } | null> {
  const audit = db.doc(`adminAudit/${commandId}`);
  const claimed = await writeAudit(
    db,
    commandId,
    { ...head, before: null, after: null, ok: null },
    now
  );
  if (!claimed) {
    const audited = await audit.get();
    const ok: unknown = audited.get('ok');
    const error: unknown = audited.get('error');
    if (ok === null) {
      return null;
    }
    return ok === true || typeof error !== 'string'
      ? { ok: ok === true }
      : { ok: false, error };
  }
  let action: AuditedAction;
  try {
    action = await act();
  } catch (error) {
    // Audited as failed, with what is known: the action may have run in
    // part, and the owner sees that in the audit.
    logger.error('Audited action failed', { commandId, error });
    action = { change: 'internal' };
  }
  const { change } = action;
  const target = action.target === undefined ? {} : { target: action.target };
  if (typeof change === 'string') {
    await audit.update({
      ...target,
      before: null,
      after: null,
      ok: false,
      error: change,
    });
    return { ok: false, error: change };
  }
  await audit.update({
    ...target,
    before: change.before,
    after: change.after,
    ok: true,
  });
  return { ok: true };
}

/** What a player is told about the owner's action (ADR 0012). */
export type NoticeType =
  | 'profile-reset'
  | 'image-removed'
  | 'board-hidden'
  | 'banned'
  | 'unbanned';

/**
 * A notice as `players/{uid}/notices/{id}` keeps it - the player reads and
 * deletes it, TTL takes it after 31 days. A ban's notice says until when
 * (null for good) and why; the owner's uid is never in it. Written in the
 * transaction that changes the ban, so it is never lost or doubled.
 */
export function noticeData(
  type: NoticeType,
  now: number,
  ban?: { until: number | null; reason: BanReason }
): Record<string, unknown> {
  return {
    type,
    at: Timestamp.fromMillis(now),
    ...(ban === undefined
      ? {}
      : {
          until: ban.until === null ? null : Timestamp.fromMillis(ban.until),
          reason: ban.reason,
        }),
    expireAt: Timestamp.fromMillis(now + NOTICE_TTL_MS),
  };
}

/** A tombstone's document: the ban's end and reason, kept until it ends. */
export function tombstoneData(
  until: number | null,
  reason: BanReason,
  now: number
): Record<string, unknown> {
  const longest = now + TOMBSTONE_TTL_MS;
  return {
    until: until === null ? null : Timestamp.fromMillis(until),
    reason,
    expireAt: Timestamp.fromMillis(
      until === null ? longest : Math.min(until, longest)
    ),
  };
}

/**
 * Scrubs the audit entries about a deleted account (ADR 0012): their
 * `before` and `after`, which may hold the replaced name and motto, become
 * `{ scrubbed: true }`; the uid, type, reason and date stay. Returns how
 * many entries it scrubbed.
 */
export async function scrubAudit(db: Firestore, uid: string): Promise<number> {
  const entries = await db
    .collection('adminAudit')
    .where('target.uid', '==', uid)
    .select()
    .get();
  const scrubbed = { scrubbed: true };
  const writer = db.bulkWriter();
  const updates = entries.docs.map((doc) =>
    writer
      .update(doc.ref, { before: scrubbed, after: scrubbed })
      .catch((error: unknown) => {
        // TTL took the entry meanwhile.
        if (!hasGrpcCode(error, 5, 'not-found')) {
          throw error;
        }
      })
  );
  await writer.close();
  await Promise.all(updates);
  return entries.size;
}
