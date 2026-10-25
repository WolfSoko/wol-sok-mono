import type { BanReason } from '@wolsok/feat-lazy-bac-game/engine';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';

/** How long an audit entry is kept (ADR 0012): 2 years, then TTL. */
export const AUDIT_TTL_MS = 2 * 365 * DAY_MS;

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
    // gRPC's ALREADY_EXISTS: audited before.
    if ((error as { code?: unknown } | null)?.code === 6) {
      return false;
    }
    throw error;
  }
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
