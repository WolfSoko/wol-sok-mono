import {
  type EndReason,
  onlineReplayId,
  type Replay,
  type ReplayKind,
  type ReplayState,
} from '@wolsok/feat-shared-bacteria-engine';
import type {
  ArrivalReason,
  OnlineReason,
} from '@wolsok/feat-shared-bacteria-engine';

/** A recorded match to keep (ADR 0011). */
export interface ReplaySubmission {
  /** The replay to store, as `parseReplay` with `stored` takes it. */
  replay: Replay;
  /** The client's own `replayScore`, 0-100 - only ranks the candidates. */
  hint: number;
  /** The ranked attempt the match was declared as (ADR 0012), if any. */
  attempt?: string;
}

/** A stored replay in the player's list, without its bytes. */
export interface ReplayListing {
  id: string;
  kind: ReplayKind;
  levelId: string;
  balanceVersion: number;
  replayVersion: number;
  /** When the match was stored, in ms since the epoch. */
  createdAt: number;
  ticks: number;
  endedBy: EndReason;
  winnerSeat: number | null;
  hint: number;
  state: ReplayState;
  /**
   * The seat the player played: online the host's is 0 and the guest's 1
   * (the stored `seats`), against the computer always 0.
   */
  seat: number;
  /** The server's score, once it played the match again. */
  score?: number;
  /**
   * Why it did or did not count on a board - an {@link ArrivalReason} for
   * a declared match, an {@link OnlineReason} for an online one - absent
   * until the functions decided, and for a match that ranks nowhere.
   */
  rankedReason?: ArrivalReason | OnlineReason;
  /** True once the player kept it out of the public gallery (`remove`). */
  galleryOut?: boolean;
  /** Its public copy in the gallery, while there is one. */
  publicId?: string;
}

/** True when a stored replay counted on its board. */
export function isCounted(listing: Pick<ReplayListing, 'rankedReason'>) {
  return listing.rankedReason === 'counted';
}

/** The most replays a list asks for - what the rules allow (ADR 0011). */
export const MAX_REPLAY_LIST = 50;

/**
 * The id an online match's replay is stored under, from its header - the
 * same on both devices and the server. Null for a replay of no online match.
 */
export function onlineIdOf(replay: Replay): string | null {
  const { roomCode, n, seed } = replay.header;
  return roomCode === undefined || n === undefined
    ? null
    : onlineReplayId(roomCode, n, seed);
}

/** The hint as the rules take it: a whole number from 0 to 100. */
export function hintOf(hint: number): number {
  return Number.isFinite(hint)
    ? Math.min(100, Math.max(0, Math.round(hint)))
    : 0;
}
