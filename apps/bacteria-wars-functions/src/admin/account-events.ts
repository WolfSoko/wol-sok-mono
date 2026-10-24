import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Account } from '../accounts';
import { entryRef, kindOf, memberOf, memberRef } from '../boards/entries';
import { isBanned } from '../limits';
import { applyTombstone, Moderation, readBan } from './bans';
import { writeTombstone } from './tombstones';

/** Documents deleted per batch. */
const PAGE = 300;

/**
 * `countAccount` (ADR 0012), on every new Auth account: `stats/accounts`
 * plus one, `boardMembers.accountCreatedAt`, and for an account created
 * with Google the ban tombstone check.
 */
export async function countAccount(
  moderation: Moderation,
  account: Account,
  now = Date.now()
): Promise<{ banned: boolean }> {
  const { db } = moderation;
  await db.doc('stats/accounts').set(
    {
      total: FieldValue.increment(1),
      updatedAt: Timestamp.fromMillis(now),
    },
    { merge: true }
  );
  await memberRef(db, account.uid).set(
    {
      accountCreatedAt: Timestamp.fromMillis(account.createdAt),
      ...(account.googleUid ? { googleChecked: true } : {}),
    },
    { merge: true }
  );
  return { banned: await applyTombstone(moderation, account, now) };
}

/** What deleting an account did to the boards. */
export interface DeletedBoards {
  entries: number;
  tombstone: boolean;
  scrubbed: number;
}

/**
 * `deletePlayerBoards` (ADR 0012), on account deletion: writes a tombstone
 * first if the player is banned and Google-linked, then deletes their
 * entries, `boardMembers`, runs, attempts, notices and ban, scrubs
 * `before`/`after` of the audit entries about them to `{ scrubbed: true }`
 * (the uid, type, reason and date stay) and lowers `stats/accounts`. Never
 * checks a ban: a banned player's deletion must erase their data.
 */
export async function deletePlayerBoards(
  moderation: Moderation,
  account: Account,
  now = Date.now()
): Promise<DeletedBoards> {
  const { db, presence } = moderation;
  const { uid } = account;
  const result: DeletedBoards = { entries: 0, tombstone: false, scrubbed: 0 };

  const ban = await readBan(db, uid);
  if (
    ban !== null &&
    isBanned(ban.until, now) &&
    account.googleUid &&
    moderation.tombstones !== null
  ) {
    await writeTombstone(
      db,
      moderation.tombstones,
      account.googleUid,
      { until: ban.until, reason: ban.reason },
      now
    );
    result.tombstone = true;
  }

  const memberSnap = await memberRef(db, uid).get();
  if (memberSnap.exists) {
    const member = memberOf(memberSnap);
    const batch = db.batch();
    // Most guests hold no entry: the engine is loaded only for one that does.
    if (member.boards.length > 0) {
      const engine = await moderation.engine();
      for (const boardId of member.boards) {
        if (engine.parseBoardId(boardId) === null) {
          continue;
        }
        const kind = kindOf(engine, boardId);
        batch.delete(entryRef(db, boardId, member.entryIds[kind]));
        result.entries++;
      }
    }
    batch.delete(memberSnap.ref);
    await batch.commit();
  }
  for (const collection of ['dailyRuns', 'endlessRuns']) {
    for (;;) {
      const page = await db
        .collection(collection)
        .where('uid', '==', uid)
        .limit(PAGE)
        .get();
      if (page.empty) {
        break;
      }
      const batch = db.batch();
      page.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }
  await db.recursiveDelete(db.collection(`players/${uid}/attempts`));
  await db.recursiveDelete(db.collection(`players/${uid}/notices`));
  await db.doc(`bans/${uid}`).delete();
  await presence.remove(`bans/${uid}`);

  const audit = await db
    .collection('adminAudit')
    .where('target.uid', '==', uid)
    .get();
  for (let i = 0; i < audit.docs.length; i += PAGE) {
    const batch = db.batch();
    for (const doc of audit.docs.slice(i, i + PAGE)) {
      batch.update(doc.ref, {
        before: { scrubbed: true },
        after: { scrubbed: true },
      });
    }
    await batch.commit();
  }
  result.scrubbed = audit.size;

  await db.doc('stats/accounts').set(
    {
      total: FieldValue.increment(-1),
      updatedAt: Timestamp.fromMillis(now),
    },
    { merge: true }
  );
  return result;
}
