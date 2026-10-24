import type { Timestamp } from 'firebase-admin/firestore';
import type { EndReason } from '@wolsok/feat-lazy-bac-game/engine';

/**
 * Where a stored replay stands (ADR 0011): `submitted` (local), `waiting`
 * (online, one report), `agreed` / `disputed` (online, both reports), and
 * after a re-run `verified`, `unverified` or `balance-mismatch`.
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

/** The room an online match was played in, as its stub named the players. */
export interface ReplayRoom {
  code: string;
  n: number;
  host: string | null;
  guest: string | null;
  createdAt: Timestamp | null;
}

/** What the server computed when it played a replay again. */
export interface ReplaySummary {
  /** The colony sizes by seat at the end. */
  sizes: number[];
  endedBy: EndReason;
  winnerSeat: number | null;
  ticks: number;
  /** The sizes once a second, at most 360 of each - Firestore holds no nested arrays. */
  timeline: { left: number[]; right: number[] };
}

/** `replays/{id}` - written by functions only. */
export interface ReplayDoc {
  /** The uids that submitted it - never a bot. */
  players: string[];
  kind: ReplayKind;
  levelId: string;
  difficulty: string;
  balanceVersion: number;
  replayVersion: number;
  createdAt: Timestamp;
  ticks: number;
  endedBy: string;
  winnerSeat: number | null;
  /** The client's own score, 0-100, which only ranks candidates. */
  hint: number;
  state: ReplayState;
  /** Players who took it down: nothing features it again. */
  optOut: string[];
  /** Absent once featured. */
  expireAt?: Timestamp;
  /** The ranked attempt, with `at` from the stored attempt (ADR 0012). */
  attempt?: { id: string; at: number };
  /** Online only. */
  room?: ReplayRoom;
  /**
   * Online only: true when a live room stub named the reporters. A match
   * reported after the stub expired is kept for whoever reported it, but
   * is never a public candidate.
   */
  bound?: boolean;
  /**
   * Why it does not count on a board (ADR 0012): a `RankedReason` of a
   * declared attempt, an `OnlineReason` of an agreed online match.
   */
  rankedReason?: string;
  /** When a board took it in. */
  rankedAt?: Timestamp;
  score?: number;
  reasons?: string[];
  summary?: ReplaySummary;
  verifiedAt?: Timestamp;
  /** Set while it is public. */
  publicId?: string;
}

/** `replays/{id}/reports/{uid}` - one per device of an online match. */
export interface ReplayReport {
  checksum: number;
  inputsHash: string;
  winnerSeat: number | null;
  endedBy: string;
  at: Timestamp;
}

/** A seat as a public replay shows it - never a picture the player uploaded. */
export interface PublicSeat {
  /** The colour id ("blue"), or "computer" for the bot. */
  label: string;
  /** The checked name, only with `publicName`. */
  name: string | null;
  colorId: string;
  /** The preset avatar of that colour. */
  avatarPreset: number;
}

/** `publicReplays/{publicId}` - closed to clients, served by `publicSite`. */
export interface PublicReplayDoc {
  replayId: string;
  /** The human uids, for `array-contains` - never shown. */
  uids: string[];
  /** The uid of each seat, null for the bot. */
  seatUids: (string | null)[];
  levelId: string;
  kind: ReplayKind;
  balanceVersion: number;
  players: PublicSeat[];
  ticks: number;
  endedBy: string;
  winnerSeat: number | null;
  score: number;
  reasons: string[];
  summary: ReplaySummary;
  featuredAt: Timestamp;
  featuredBy: 'auto' | 'admin';
  day: string;
  /** Null until it is taken down, so queries on `removedAt == null` find it. */
  removedAt: Timestamp | null;
  /** True once the owner anonymised it: no name comes back. */
  anonymised?: boolean;
}
