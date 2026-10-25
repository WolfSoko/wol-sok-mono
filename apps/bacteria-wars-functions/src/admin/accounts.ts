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
