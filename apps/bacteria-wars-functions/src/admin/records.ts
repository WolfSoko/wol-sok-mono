import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import type { BanReason, NoticeType } from '@wolsok/feat-lazy-bac-game/engine';
import { AUDIT_YEARS } from '../config';
import { DAY_MS } from '../time';

/**
 * What moderation leaves behind (ADR 0012): notices for the player, the
 * owner's audit and the moderation counters.
 */

/** Days a notice is kept (TTL). */
export const NOTICE_DAYS = 31;

/** Tells the player what the owner's moderation did. */
export async function notify(
  db: Firestore,
  uid: string,
  type: NoticeType,
  now: number,
  extra: { until?: number | null; reason?: BanReason } = {}
): Promise<void> {
  await db.collection(`players/${uid}/notices`).add({
    type,
    at: Timestamp.fromMillis(now),
    ...(extra.until === undefined
      ? {}
      : {
          until:
            extra.until === null ? null : Timestamp.fromMillis(extra.until),
        }),
    ...(extra.reason === undefined ? {} : { reason: extra.reason }),
    expireAt: Timestamp.fromMillis(now + NOTICE_DAYS * DAY_MS),
  });
}

/** The moderation counters of a player. */
export type ModerationCounter =
  | 'resets'
  | 'imageRemovals'
  | 'hides'
  | 'bans'
  | 'failedChecks';

export async function countModeration(
  db: Firestore,
  uid: string,
  counter: ModerationCounter
): Promise<void> {
  await db
    .doc(`moderation/${uid}`)
    .set({ [counter]: FieldValue.increment(1) }, { merge: true });
}

/** Who or what an audit entry is about. */
export interface AuditTarget {
  uid?: string;
  boardId?: string;
  entryId?: string;
  replayId?: string;
}

/** An entry of the owner's audit. */
export interface AuditEntry {
  by: string;
  type: string;
  target: AuditTarget;
  reason: string | null;
  before: unknown;
  after: unknown;
  ok: boolean;
  source: 'adminCommand' | 'replayCommand' | 'system';
}

/** Writes `adminAudit/{id}`, kept 2 years. */
export async function writeAudit(
  db: Firestore,
  id: string,
  entry: AuditEntry,
  now: number
): Promise<void> {
  await db.doc(`adminAudit/${id}`).set({
    ...entry,
    before: entry.before ?? null,
    after: entry.after ?? null,
    at: Timestamp.fromMillis(now),
    expireAt: Timestamp.fromMillis(now + AUDIT_YEARS * 365 * DAY_MS),
  });
}
