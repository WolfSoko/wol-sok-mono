import type { Replay } from '../state/replay';
import { onlineReplayId } from '../state/replay-id';
import type { EndReason } from '../state/win-conditions';

/** A recorded match to keep (ADR 0011). */
export interface ReplaySubmission {
  /** The version 2 replay - CPU only, on the online grid of its level. */
  replay: Replay;
  /** The client's own `replayScore`, 0-100 - only ranks the candidates. */
  hint: number;
  /** The ranked attempt the match was declared as (ADR 0012), if any. */
  attempt?: string;
}

/**
 * Where a stored replay stands - see ADR 0011's data model. `submitted` is
 * a local match, `waiting` and `agreed` online ones with one or both
 * reports.
 */
export type ReplayState =
  | 'submitted'
  | 'waiting'
  | 'agreed'
  | 'disputed'
  | 'verified'
  | 'unverified'
  | 'balance-mismatch';

/** What kind of match a replay is - derived by the server, never claimed. */
export type ReplayKind = 'online' | 'computer' | 'daily' | 'endless';

/**
 * Why a declared (ranked) match did or did not count on its board - the
 * functions' `ArrivalReason` (`boards/declared-match.ts`), on the stored
 * replay as `rankedReason`.
 */
export const ARRIVAL_REASONS = [
  'counted',
  'ruleset',
  'seed',
  'plan-mismatch',
  'level',
  'early',
  'late',
  'banned',
  'no-attempt',
  'void',
  'duplicate',
  'unreadable',
] as const;
export type ArrivalReason = (typeof ARRIVAL_REASONS)[number];

/**
 * Why an online match did or did not count on the online board - the
 * functions' `OnlineReason` (`boards/rank-online.ts`), and `not-reported`,
 * which the hourly sweep writes on a match only one device reported.
 */
export const ONLINE_REASONS = [
  'counted',
  'desync',
  'short',
  'stub-expired',
  'banned',
  'too-fast',
  'pair-cap',
  'not-reported',
] as const;
export type OnlineReason = (typeof ONLINE_REASONS)[number];

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
  /** The ruleset it was played on (`cpu`, `gpu-int`). */
  simulation?: string;
  /** When the server lets it go, in ms - 30 days after the match. */
  expireAt?: number;
  /** The ranked attempt it was declared as (ADR 0012). */
  attempt?: { id: string; at: number };
  /**
   * Why it did or did not count on a board - an {@link ArrivalReason} for
   * a declared match, an {@link OnlineReason} for an online one - absent
   * until the functions decided, and for a match that ranks nowhere.
   */
  rankedReason?: ArrivalReason | OnlineReason;
  /** Online: reported after its room had expired - kept, never public. */
  stubExpired?: boolean;
  /** True once the player kept it out of the public gallery (`remove`). */
  galleryOut?: boolean;
  /** Its public copy in the gallery, while there is one. */
  publicId?: string;
}

/** True when a stored replay counted on its board. */
export function isCounted(listing: Pick<ReplayListing, 'rankedReason'>) {
  return listing.rankedReason === 'counted';
}

/** What a player may ask of a replay; all but `remove` only the owner. */
export type ReplayCommandType =
  | 'remove'
  | 'feature'
  | 'unfeature'
  | 'anonymise';

/** What the server made of a command. */
export interface ReplayCommandResult {
  ok: boolean;
  /** Why not, when it did not - an id, never a text to show as it is. */
  reason?: string;
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

/** A command's result as stored - null for none or one it cannot read. */
export function parseCommandResult(value: unknown): ReplayCommandResult | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { ok, reason } = value as Record<string, unknown>;
  if (typeof ok !== 'boolean') {
    return null;
  }
  return typeof reason === 'string' ? { ok, reason } : { ok };
}
