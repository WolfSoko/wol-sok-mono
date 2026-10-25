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

/** One audit entry (`adminAudit/{id}`) - readable by the owner only. */
export interface AuditEntry {
  by: string;
  type: string;
  target: Record<string, unknown>;
  reason: string;
  before: unknown;
  after: unknown;
  ok: boolean;
  source: 'adminCommand' | 'replayCommand' | 'system';
}

export async function writeAudit(
  db: Firestore,
  id: string,
  entry: AuditEntry,
  now: number
): Promise<void> {
  await db.doc(`adminAudit/${id}`).set({
    ...entry,
    at: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(now + AUDIT_TTL_MS),
  });
}
