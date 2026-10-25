import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { HOUR_MS } from '../boards/budgets';
import { memberEntries } from '../boards/entries';
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
 * the same identity is banned again. Then its entries, membership, runs,
 * attempts, notices, moderation counters and ban go; the audit entries
 * about it keep no reason and only `{ scrubbed: true }` for before and
 * after; `stats/accounts` drops.
 */
export async function deletePlayerBoards(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  googleUid: string | null,
  now: number
): Promise<{ entries: number; runs: number; audit: number }> {
  const [ban, member, endlessRuns, dailyRuns, audit] = await Promise.all([
    db.doc(`bans/${uid}`).get(),
    db.doc(`boardMembers/${uid}`).get(),
    db.collection('endlessRuns').where('uid', '==', uid).select().get(),
    db.collection('dailyRuns').where('uid', '==', uid).select().get(),
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
  const entryRefs = memberEntries(member.data() ?? {}).map(
    ({ boardId, entryId }) => db.doc(`boards/${boardId}/entries/${entryId}`)
  );
  const writer = db.bulkWriter();
  const writes = [
    ...[
      ...entryRefs,
      ...endlessRuns.docs.map((doc) => doc.ref),
      ...dailyRuns.docs.map((doc) => doc.ref),
      member.ref,
      ban.ref,
      db.doc(`moderation/${uid}`),
    ].map((ref) => writer.delete(ref)),
    // The owner's reason may quote what the player wrote: it goes too.
    ...audit.docs.map((doc) =>
      writer.update(doc.ref, {
        reason: '',
        before: { scrubbed: true },
        after: { scrubbed: true },
      })
    ),
    writer.set(
      db.doc('stats/accounts'),
      {
        total: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ];
  await writer.close();
  // An audit entry the TTL took meanwhile is no loss; others are logged.
  const failed = (await Promise.allSettled(writes)).filter(
    (result) => result.status === 'rejected'
  );
  if (failed.length > 0) {
    logger.warn('Some writes of a deleted account failed', {
      uid,
      failed: failed.length,
    });
  }
  await Promise.all([
    db.recursiveDelete(db.collection(`players/${uid}/attempts`)),
    db.recursiveDelete(db.collection(`players/${uid}/notices`)),
    deps.rtdb.remove(`bans/${uid}`),
  ]);
  return {
    entries: entryRefs.length,
    runs: endlessRuns.size + dailyRuns.size,
    audit: audit.size,
  };
}
