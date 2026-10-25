import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { deletePlayerBoards } from '../boards/delete-player';
import { holds, notedTombstones, readBan } from './bans';
import type { Realtime } from './realtime';
import { scrubAudit, tombstoneData } from './records';
import { applyTombstone } from './tombstones';

/** What `countAccount` reads from the new Auth user. */
export interface NewAccount {
  /** When Auth made it, null when it does not say. */
  createdAt: number | null;
  /** Its ban tombstone id, null without a Google provider. */
  tombstone: string | null;
}

/** The accounts counter (ADR 0012): `{ total, updatedAt }`. */
export const ACCOUNTS_DOC = 'stats/accounts';

/**
 * A new account (ADR 0012, `countAccount`): `stats/accounts` + 1 and
 * `boardMembers/{uid}.accountCreatedAt`, in one transaction that notes
 * `accountCounted`, so an event delivered twice counts once; and for a
 * Google sign-up the tombstone check, noted as `googleChecked`. True when
 * the tombstone banned it.
 */
export async function countAccount(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  account: NewAccount,
  now: number
): Promise<boolean> {
  const member = db.doc(`boardMembers/${uid}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(member)).get('accountCounted') === true) {
      return;
    }
    tx.set(
      member,
      {
        accountCounted: true,
        ...(account.createdAt === null
          ? {}
          : { accountCreatedAt: Timestamp.fromMillis(account.createdAt) }),
      },
      { merge: true }
    );
    tx.set(db.doc(ACCOUNTS_DOC), accountsChange(1, now), { merge: true });
  });
  return account.tombstone === null
    ? false
    : applyTombstone(db, realtime, uid, account.tombstone, now);
}

/**
 * How `stats/accounts` changes: +1 in `countAccount`, -1 in
 * `deletePlayerBoards` for an account `countAccount` counted.
 * `stats.recount` sets it exactly.
 */
export function accountsChange(
  by: 1 | -1,
  now: number
): Record<string, unknown> {
  return {
    total: FieldValue.increment(by),
    updatedAt: Timestamp.fromMillis(now),
  };
}

/**
 * A deleted account (ADR 0012, the `deletePlayerBoards` trigger): erases
 * its board data (`deletePlayerBoards`), scrubs the audit entries about it
 * and lowers `stats/accounts` if `countAccount` counted it. Both ban
 * documents go once a banned account's tombstone is written - by the id
 * of its Google provider (`tombstone`), and those its bans noted - so the
 * ban survives the deletion. Runs for banned accounts too: a deletion must
 * erase the player's data. Throws when a step fails, after the others
 * ran; returns the board documents it went through.
 */
export async function deleteAccount(
  db: Firestore,
  uid: string,
  { tombstone, realtime }: { tombstone: string | null; realtime: Realtime },
  now: number
): Promise<number> {
  const [member, moderation] = await Promise.all([
    db.doc(`boardMembers/${uid}`).get(),
    db.doc(`moderation/${uid}`).get(),
  ]);
  const ids = new Set(notedTombstones(moderation.data()));
  if (tombstone !== null) {
    ids.add(tombstone);
  }
  const [boards, ...rest] = await Promise.allSettled([
    deletePlayerBoards(db, uid),
    scrubAudit(db, uid),
    member.get('accountCounted') === true
      ? db.doc(ACCOUNTS_DOC).set(accountsChange(-1, now), { merge: true })
      : undefined,
    keepAsTombstones(db, uid, [...ids], now).then(() =>
      Promise.all([
        db.doc(`bans/${uid}`).delete(),
        realtime.remove(`bans/${uid}`),
      ])
    ),
  ]);
  for (const result of [boards, ...rest]) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }
  return boards.status === 'fulfilled' ? boards.value : 0;
}

/** Writes a banned account's tombstones (by `ids`) while its ban holds. */
async function keepAsTombstones(
  db: Firestore,
  uid: string,
  ids: readonly string[],
  now: number
): Promise<void> {
  const ban = await readBan(db, uid);
  if (ban === null || !holds(ban, now)) {
    return;
  }
  const batch = db.batch();
  for (const id of ids) {
    batch.set(
      db.doc(`banTombstones/${id}`),
      tombstoneData(ban.until, ban.reason, now)
    );
  }
  await batch.commit();
}
