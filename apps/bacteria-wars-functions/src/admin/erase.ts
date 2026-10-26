import type { Firestore } from 'firebase-admin/firestore';
import { forgetPlayerReplays } from '../replays/forget';
import { settleAll } from '../settle';
import { deletePlayerSocial } from '../social/delete-player';
import { type DeletedAccount, deleteAccount } from './accounts';
import type { Realtime } from './realtime';

/**
 * Everything a deleted account's data goes through (ADR 0011, 0012, owner's
 * decision of 2026-10-26), in one call - what the three `onDelete`
 * triggers do each for their part (`deletePlayerBoards`: boards, bans,
 * audit, count; `deletePlayerReplays`: replays kept anonymised;
 * `deletePlayerData`: profile, progress, friends, queue, rooms, invites,
 * presence), for `guestCleanup`, whose bulk deletion fires no trigger.
 * `tombstone` is the account's ban tombstone id, null without a Google
 * provider - always null for a guest. With `uncounted`, the caller lowers
 * `stats/accounts` itself (`deleteAccount`). Every part runs, then the
 * first failure is thrown.
 */
export async function erasePlayer(
  db: Firestore,
  realtime: Realtime,
  uid: string,
  tombstone: string | null,
  now: number,
  { uncounted }: Pick<DeletedAccount, 'uncounted'> = {}
): Promise<void> {
  await settleAll([
    deleteAccount(db, uid, { tombstone, realtime, uncounted }, now),
    forgetPlayerReplays(db, uid, now),
    deletePlayerSocial(db, realtime, uid),
  ]);
}
