import {
  FieldValue,
  type Firestore,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { HOUR_MS } from '../boards/budgets';
import { deletePlayerBoards as deleteBoardData } from '../boards/delete-player';
import { banHolds, banUntil } from '../limits';
import { applyTombstone, writeTombstone } from './bans';
import type { AdminDeps } from './deps';

/** Bans a uid again when its Google identity has a tombstone. */
const recheck = async (
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  googleUid: string | null,
  now: number
) => ({
  rebanned:
    googleUid !== null && (await applyTombstone(db, deps, uid, googleUid, now)),
});

/**
 * `countAccount` (ADR 0012): a new account raises `stats/accounts` and
 * notes when it was made; a Google sign-up whose identity is banned in a
 * tombstone is banned again at once.
 */
export async function countAccount(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  googleUid: string | null,
  createdAt: number,
  now: number
): Promise<{ rebanned: boolean }> {
  await Promise.all([
    db.doc('stats/accounts').set(
      {
        total: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    db.doc(`boardMembers/${uid}`).set(
      {
        accountCreatedAt: Timestamp.fromMillis(createdAt),
        ...(googleUid === null ? {} : { googleChecked: true }),
      },
      { merge: true }
    ),
  ]);
  return recheck(db, deps, uid, googleUid, now);
}

/**
 * Once a guest links Google (ADR 0012), checks the identity against the
 * tombstones - the first progress save after the link finds it. A guest is
 * looked up at most once an hour, a Google account once.
 */
export async function checkGoogleLink(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  now: number,
  /** `boardMembers/{uid}` when the caller has read it already. */
  known?: Record<string, unknown>
): Promise<{ rebanned: boolean } | null> {
  const memberRef = db.doc(`boardMembers/${uid}`);
  const member = known ?? (await memberRef.get()).data() ?? {};
  const checkedAt = member['googleCheckedAt'];
  if (
    member['googleChecked'] === true ||
    (checkedAt instanceof Timestamp && now - checkedAt.toMillis() < HOUR_MS)
  ) {
    return null;
  }
  const googleUid = (await deps.account(uid))?.googleUid ?? null;
  await memberRef.set(
    googleUid === null
      ? { googleCheckedAt: Timestamp.fromMillis(now) }
      : { googleChecked: true, googleCheckedAt: FieldValue.delete() },
    { merge: true }
  );
  return recheck(db, deps, uid, googleUid, now);
}

/**
 * `deletePlayerBoards` (ADR 0012): a deleted account leaves the boards.
 * A banned Google account first gets its tombstone, so a new account of
 * the same identity is banned again. Then its board data goes (see the
 * boards' `deletePlayerBoards`) with its ban; the audit entries about it
 * keep no reason and only `{ scrubbed: true }` for before and after;
 * `stats/accounts` drops. Throws when a board delete failed, after the
 * others ran.
 */
export async function deletePlayerBoards(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  googleUid: string | null,
  now: number
): Promise<{ deleted: number; audit: number }> {
  const [ban, audit] = await Promise.all([
    db.doc(`bans/${uid}`).get(),
    db.collection('adminAudit').where('target.uid', '==', uid).select().get(),
  ]);
  const until = banUntil(ban.data());
  if (googleUid !== null && ban.exists && banHolds(until, now)) {
    await writeTombstone(
      db,
      deps,
      googleUid,
      until,
      String(ban.get('reason') ?? 'other'),
      now
    );
  }
  const [deleted] = await Promise.all([
    deleteBoardData(db, uid),
    ban.ref.delete(),
    deps.rtdb.remove(`bans/${uid}`),
    db.doc('stats/accounts').set(
      {
        total: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
    scrubAudit(db, uid, audit.docs),
  ]);
  return { deleted, audit: audit.size };
}

/**
 * The owner's reason may quote what the player wrote: it goes, with what
 * the audit kept. An entry the TTL took meanwhile is no loss; other
 * failures are logged.
 */
async function scrubAudit(
  db: Firestore,
  uid: string,
  docs: readonly QueryDocumentSnapshot[]
): Promise<void> {
  const writer = db.bulkWriter();
  const writes = docs.map((doc) =>
    writer.update(doc.ref, {
      reason: '',
      before: { scrubbed: true },
      after: { scrubbed: true },
    })
  );
  await writer.close();
  const failed = (await Promise.allSettled(writes)).filter(
    (result) => result.status === 'rejected'
  );
  if (failed.length > 0) {
    logger.warn('Could not scrub audit entries of a deleted account', {
      uid,
      failed: failed.length,
    });
  }
}
