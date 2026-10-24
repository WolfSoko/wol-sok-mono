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
  /** The server's score, once it played the match again. */
  score?: number;
}

/** What a player may ask of a replay; all but `remove` only the owner. */
export type { ReplayCommandType } from '../state/admin-commands';

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
