import { banHolds } from '@wolsok/feat-shared-bacteria-engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { boardRefsOf } from '../boards/delete-player';
import { deleteRefs } from '../deletes';
import type { ErasureContext } from '../erasure/context';
import { eraseListed } from '../erasure/erase-listed';
import { settleAll } from '../settle';
import { notedTombstones, readBan } from './bans';
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
 * `deleteAccount` for an account `countAccount` counted, and minus
 * the guests a `guestCleanup` batch erased, at once. `stats.recount` sets
 * it exactly.
 */
export function accountsChange(
  by: number,
  now: number
): Record<string, unknown> {
  return {
    total: FieldValue.increment(by),
    updatedAt: Timestamp.fromMillis(now),
  };
}

/**
 * The `account` part of the erasure (ADR 0012, the `deletePlayerBoards`
 * trigger, through `erasePart`): what `PLAYER_DATA` lists of it -
 * `boardMembers`, `limits`, `moderation`, `endlessRuns`, `pairs`, the
 * owner's `adminCommands` about it - and its board entries and `dailyRuns`
 * (`boardRefsOf`); scrubs the audit entries about it and lowers `stats/accounts` if `countAccount` counted it - once, as
 * `uncount` claims that first, so a retried or doubled erase lowers it no
 * further (with `uncounted`, the caller lowers it). Both ban documents go
 * once a banned account's tombstone is written - by the id of its Google
 * provider (`tombstone`), and those its bans noted - so the ban survives
 * the deletion. Runs for banned accounts too: a deletion must erase the
 * player's data. Throws when a step fails, after the others ran; returns
 * the documents it deleted.
 */
export async function deleteAccount(
  ctx: ErasureContext,
  uid: string
): Promise<number> {
  const { db, realtime, tombstone, uncounted, now } = ctx;
  // What goes with `boardMembers` and `moderation` - read before them.
  const [counted, moderation, boardRefs] = await Promise.all([
    uncount(db, uid),
    db.doc(`moderation/${uid}`).get(),
    boardRefsOf(db, uid),
  ]);
  const ids = new Set(notedTombstones(moderation.data()));
  if (tombstone !== null) {
    ids.add(tombstone);
  }
  const [boards, listed] = await settleAll([
    deleteRefs(db, boardRefs),
    eraseListed(ctx, uid, 'account'),
    scrubAudit(db, uid),
    !counted
      ? undefined
      : uncounted === undefined
        ? db.doc(ACCOUNTS_DOC).set(accountsChange(-1, now), { merge: true })
        : uncounted(),
    keepAsTombstones(db, uid, [...ids], now).then(() =>
      Promise.all([
        db.doc(`bans/${uid}`).delete(),
        realtime.remove(`bans/${uid}`),
      ])
    ),
  ]);
  return boards + listed;
}

/**
 * Claims the account's decrement of `stats/accounts`: clears
 * `accountCounted` on `boardMembers/{uid}` in a transaction, and is true
 * when it was set. Whoever claims it lowers the count; one that fails to
 * after the claim leaves the count one too high, which `stats.recount`
 * mends.
 */
async function uncount(db: Firestore, uid: string): Promise<boolean> {
  const member = db.doc(`boardMembers/${uid}`);
  return db.runTransaction(async (tx) => {
    if ((await tx.get(member)).get('accountCounted') !== true) {
      return false;
    }
    tx.update(member, { accountCounted: FieldValue.delete() });
    return true;
  });
}

/** Writes a banned account's tombstones (by `ids`) while its ban holds. */
async function keepAsTombstones(
  db: Firestore,
  uid: string,
  ids: readonly string[],
  now: number
): Promise<void> {
  const ban = await readBan(db, uid);
  if (ban === null || !banHolds(ban, now)) {
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
