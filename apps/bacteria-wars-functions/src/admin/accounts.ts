import {
  type BoardKind,
  parseBoardId,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { applyTombstone, writeTombstone } from './bans';
import type { AdminDeps } from './deps';

const HOUR_MS = 3_600_000;

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
  return {
    rebanned:
      googleUid !== null &&
      (await applyTombstone(db, deps, uid, googleUid, now)),
  };
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
  const account = await deps.account(uid);
  const googleUid = account?.googleUid ?? null;
  await memberRef.set(
    googleUid === null
      ? { googleCheckedAt: Timestamp.fromMillis(now) }
      : { googleChecked: true, googleCheckedAt: FieldValue.delete() },
    { merge: true }
  );
  return {
    rebanned:
      googleUid !== null &&
      (await applyTombstone(db, deps, uid, googleUid, now)),
  };
}

/**
 * `deletePlayerBoards` (ADR 0012): a deleted account leaves the boards.
 * A banned Google account first gets its tombstone, so a new account of
 * the same identity is banned again. Then its entries, membership, runs,
 * attempts, notices and ban go, the audit entries about it keep only
 * `{ scrubbed: true }` for before and after, and `stats/accounts` drops.
 */
export async function deletePlayerBoards(
  db: Firestore,
  deps: AdminDeps,
  uid: string,
  googleUid: string | null,
  now: number
): Promise<{ entries: number; runs: number; audit: number }> {
  const ban = (await db.doc(`bans/${uid}`).get()).data();
  const until =
    ban?.['until'] instanceof Timestamp ? ban['until'].toMillis() : null;
  if (
    googleUid !== null &&
    ban !== undefined &&
    (until === null || until > now)
  ) {
    await writeTombstone(
      db,
      deps,
      googleUid,
      until,
      String(ban['reason'] ?? 'other'),
      now
    );
  }
  const member = (await db.doc(`boardMembers/${uid}`).get()).data() ?? {};
  const entryIds = (member['entryIds'] ?? {}) as Partial<
    Record<BoardKind, string>
  >;
  const boards = (member['boards'] as string[] | undefined) ?? [];
  const entryRefs = boards.flatMap((boardId) => {
    const kind = parseBoardId(boardId)?.kind;
    const entryId = kind === undefined ? undefined : entryIds[kind];
    return entryId === undefined
      ? []
      : [db.doc(`boards/${boardId}/entries/${entryId}`)];
  });
  const [endlessRuns, dailyRuns, audit] = await Promise.all([
    db.collection('endlessRuns').where('uid', '==', uid).get(),
    db.collection('dailyRuns').where('uid', '==', uid).get(),
    db.collection('adminAudit').where('target.uid', '==', uid).get(),
  ]);
  const writer = db.bulkWriter();
  const writes = [
    ...[
      ...entryRefs,
      ...endlessRuns.docs.map((doc) => doc.ref),
      ...dailyRuns.docs.map((doc) => doc.ref),
      db.doc(`boardMembers/${uid}`),
      db.doc(`bans/${uid}`),
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
