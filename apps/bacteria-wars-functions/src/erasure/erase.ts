import { deleteAccount } from '../admin/accounts';
import { forgetPlayerReplays } from '../replays/forget';
import { settleAll } from '../settle';
import { deletePlayerSocial } from '../social/delete-player';
import type { ErasureContext } from './context';
import { ERASURE_PARTS, type ErasurePart } from './player-data';

/**
 * Erases one part of a deleted account's data (ADR 0011, 0012, owner's
 * decision of 2026-10-26), as `PLAYER_DATA` assigns it - the one entry
 * point of each `onDelete` trigger: `account` (`deletePlayerBoards`:
 * boards, bans, audit, count), `replays` (`deletePlayerReplays`: replays
 * kept anonymised, pending submissions and commands) and `social`
 * (`deletePlayerData`: profile, progress, friends, queue, rooms, invites,
 * presence). Idempotent; throws when a step fails, after the others ran.
 * What it went through, for the log.
 */
export async function erasePart(
  part: ErasurePart,
  ctx: ErasureContext,
  uid: string
): Promise<Record<string, number>> {
  switch (part) {
    case 'account':
      return { deleted: await deleteAccount(ctx, uid) };
    case 'replays':
      return forgetPlayerReplays(ctx, uid);
    case 'social':
      return deletePlayerSocial(ctx, uid);
  }
}

/**
 * Every part of a deleted account's erasure in one call, for
 * `guestCleanup`, whose bulk deletion fires no trigger. Every part runs,
 * then the first failure is thrown.
 */
export async function erasePlayer(
  ctx: ErasureContext,
  uid: string
): Promise<void> {
  await settleAll(ERASURE_PARTS.map((part) => erasePart(part, ctx, uid)));
}
