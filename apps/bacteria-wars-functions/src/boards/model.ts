import type { Timestamp } from 'firebase-admin/firestore';
import type {
  BoardKind,
  EntryShow,
  EntryStatus,
  XpLedger,
} from '@wolsok/feat-lazy-bac-game/engine';

/**
 * The documents of the leaderboards (ADR 0012) as the functions write
 * them. Clients read only `boards/{boardId}`, its visible `entries` and
 * their own `boardMembers/{uid}`; everything else is the functions' own.
 */

/** Why an entry is hidden: by the owner, a ban, or the player's opt-out. */
export type HiddenBy = 'admin' | 'ban' | 'optout';

/** A status an entry has when nothing hides it. */
export type ShownStatus = Exclude<EntryStatus, 'hidden'>;

/** `boards/{boardId}/entries/{entryId}`. */
export interface EntryDoc {
  sort: number;
  atHour: number;
  status: EntryStatus;
  /** The status it shows again once nothing hides it. */
  baseStatus: ShownStatus;
  name: string | null;
  tag: number;
  avatar: number;
  show: EntryShow;
  updatedAt: Timestamp;
  /** Daily boards only: the TTL. */
  expireAt?: Timestamp;
}

/** A player's counts on the online board, `boardMembers/{uid}.record`. */
export interface OnlineRecord {
  w: number;
  l: number;
  d: number;
  /** Matches the opponent reported and the player did not. */
  nr: number;
}

/** The online caps of a UTC day, `boardMembers/{uid}.online`. */
export interface OnlineDay {
  day: string;
  wins: number;
  newOpponentWins: number;
}

/** `boardMembers/{uid}` - the player and the owner may read it. */
export interface MemberDoc {
  /** One random entry id per board kind; daily is the same every day. */
  entryIds: Record<BoardKind, string>;
  /** Every board holding one of the player's entries. */
  boards: string[];
  /** Board kinds that ignore the player (the owner's bar). */
  barred: BoardKind[];
  hiddenBy: Record<string, HiddenBy>;
  xp?: XpLedger;
  online?: OnlineDay;
  record?: OnlineRecord;
  accountCreatedAt?: Timestamp;
  googleChecked?: boolean;
  activeAt?: Timestamp;
  /** True once one of the player's daily or endless entries was verified. */
  verifiedBefore?: boolean;
  /** The UTC day each board last had a candidate of the player re-run. */
  checks?: Record<string, string>;
}

/** A daily attempt's standing in `dailyRuns`. */
export type AttemptState = 'provisional' | 'verified' | 'failed' | 'stale';

/** One accepted attempt of a day. */
export interface DailyAttemptRow {
  attemptId: string;
  replayId: string;
  sort: number;
  ticks: number;
  won: boolean;
  /** The hour the replay arrived. */
  atHour: number;
  balanceVersion: number;
  state: AttemptState;
}

/** `dailyRuns/{day}_{uid}` - nobody reads it but the functions. */
export interface DailyRunDoc {
  uid: string;
  day: string;
  attempts: DailyAttemptRow[];
  expireAt: Timestamp;
}

/** How a declared match of an endless run stands. */
export type RunMatchState =
  /** Neither a replay nor two hours yet - or a pending submission. */
  | 'open'
  | 'won'
  /** Lost, no replay in time, or a replay that does not rank. */
  | 'lost'
  /** Dropped by the server: counts for nothing. */
  | 'void'
  /** After the third lost life, or waiting on an open match before it. */
  | 'after';

/** One declared match of a run. */
export interface RunMatch {
  index: number;
  attemptId: string;
  at: number;
  replayId: string | null;
  state: RunMatchState;
  /** Matches with a replay: their length in ticks, the one source. */
  ticks?: number;
  /** Why the replay does not rank, if it does not. */
  reason?: string;
  /** Won matches: true once re-run and confirmed. */
  verified?: boolean;
  /** Won matches: true once a re-run could not confirm it. */
  failed?: boolean;
  /** Won matches: true once the replay expired before a re-run. */
  gone?: boolean;
  balanceVersion?: number;
}

/** Where a run stands as a whole. */
export type RunStatus = 'provisional' | 'verified' | 'stale';

/** `endlessRuns/{uid}_{runId}` - nobody reads it but the functions. */
export interface EndlessRunDoc {
  uid: string;
  runId: string;
  /** The run seed: the seed of its match 0. */
  seed: number;
  matches: RunMatch[];
  /** Set once a win failed its re-run: the run ends at this depth. */
  cutAt?: number;
  /**
   * The depth and seconds the run ranks with: the wins before the third
   * lost life (or the cut), and their seconds rounded from their ticks.
   */
  depth: number;
  seconds: number;
  /** `verified` once every win counted is confirmed by a re-run. */
  status: RunStatus;
  /** The earliest moment an open match closes as a lost life. */
  nextCloseAt: Timestamp | null;
  /** The owner asked for it to be verified: first in the hourly queue. */
  queued?: boolean;
  /** True for the player's best run, which keeps no `expireAt`. */
  best: boolean;
  updatedAt: Timestamp;
  expireAt?: Timestamp;
}
