import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { DAY_MS } from '../boards/budgets';

/** How long a notice waits for its player (TTL). */
const NOTICE_TTL_MS = 31 * DAY_MS;
/** How long the audit is kept (TTL). */
export const AUDIT_TTL_MS = 2 * 365 * DAY_MS;

/** What a player is told about the owner's action (ADR 0012). */
export type NoticeType =
  | 'profile-reset'
  | 'image-removed'
  | 'board-hidden'
  | 'banned'
  | 'unbanned';

/**
 * `players/{uid}/notices/{id}`, which the player reads and deletes; the id
 * is the command's, so a repeated command writes one notice.
 */
export async function writeNotice(
  db: Firestore,
  uid: string,
  id: string,
  fields: { type: NoticeType } & Record<string, unknown>,
  now: number
): Promise<void> {
  await db.doc(`players/${uid}/notices/${id}`).set({
    ...fields,
    at: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(now + NOTICE_TTL_MS),
  });
}

/** Who acted, on what and why - the start of an audit entry. */
export interface AuditClaim {
  /** The owner's uid, or `system`. */
  by: string;
  type: string;
  target: Record<string, unknown> | null;
  reason: string;
  source: 'adminCommand' | 'replayCommand' | 'system';
}

/**
 * Claims `adminAudit/{id}` before an action runs - `create()`, so a second
 * delivery of the same command (or a second run of the same system step)
 * finds it taken and does nothing: false then. {@link settleAudit} records
 * how it went.
 */
export async function claimAudit(
  db: Firestore,
  id: string,
  claim: AuditClaim,
  now: number
): Promise<boolean> {
  try {
    await db.doc(`adminAudit/${id}`).create({
      ...claim,
      ok: false,
      before: null,
      after: null,
      at: FieldValue.serverTimestamp(),
      expireAt: Timestamp.fromMillis(now + AUDIT_TTL_MS),
    });
    return true;
  } catch (error) {
    // ALREADY_EXISTS: claimed before.
    if ((error as { code?: unknown }).code === 6) {
      return false;
    }
    throw error;
  }
}

/** What an action changed, or why it failed - on its audit entry. */
export async function settleAudit(
  db: Firestore,
  id: string,
  outcome:
    | { ok: true; before: unknown; after: unknown }
    | { ok: false; error: string }
): Promise<void> {
  await db.doc(`adminAudit/${id}`).update({
    ...outcome,
    ...(outcome.ok
      ? { before: outcome.before ?? null, after: outcome.after ?? null }
      : {}),
  });
}

/** Counts an action against a player in `moderation/{uid}`. */
export async function bumpModeration(
  db: Firestore,
  uid: string,
  counter: 'resets' | 'imageRemovals' | 'hides' | 'bans'
): Promise<void> {
  await db
    .doc(`moderation/${uid}`)
    .set({ [counter]: FieldValue.increment(1) }, { merge: true });
}
