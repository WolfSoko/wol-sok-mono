import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import type { Realtime } from './realtime';
import { applyTombstone } from './tombstones';

/** What `countAccount` reads from the new Auth user. */
export interface NewAccount {
  /** When Auth made it, null when it does not say. */
  createdAt: number | null;
  /** Its ban tombstone id, null without a Google provider. */
  tombstone: string | null;
}

/**
 * A new account (ADR 0012, `countAccount`): `stats/accounts` + 1,
 * `boardMembers/{uid}.accountCreatedAt`, and for a Google sign-up the
 * tombstone check, noted as `googleChecked`. True when the tombstone
 * banned it.
 */
export async function countAccount(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  account: NewAccount,
  now: number
): Promise<boolean> {
  const member = db.doc(`boardMembers/${uid}`);
  await Promise.all([
    changeAccounts(db, 1, now),
    account.createdAt === null
      ? undefined
      : member.set(
          { accountCreatedAt: Timestamp.fromMillis(account.createdAt) },
          { merge: true }
        ),
  ]);
  if (account.tombstone === null) {
    return false;
  }
  const banned = await applyTombstone(
    db,
    realtime,
    uid,
    account.tombstone,
    now
  );
  await member.set({ googleChecked: true }, { merge: true });
  return banned;
}

/**
 * Counts accounts in `stats/accounts` up or down: +1 in `countAccount`, -1
 * in `deletePlayerBoards`. `stats.recount` sets it exactly.
 */
export async function changeAccounts(
  db: Firestore,
  by: 1 | -1,
  now: number
): Promise<void> {
  await db
    .doc('stats/accounts')
    .set(
      { total: FieldValue.increment(by), updatedAt: Timestamp.fromMillis(now) },
      { merge: true }
    );
}
