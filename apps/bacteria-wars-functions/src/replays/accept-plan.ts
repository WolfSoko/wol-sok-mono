import {
  dailyLevelId,
  onlineReplayId,
  parseAttemptId,
  type Replay,
} from '@wolsok/feat-lazy-bac-game/engine';
import { createHash } from 'node:crypto';
import { dayOf } from '../limits';

/** What kind of match a replay is - derived here, never claimed. */
export type ReplayKind = 'online' | 'computer' | 'daily' | 'endless';

/** A submission as the function reads it, beside its replay. */
export interface SubmissionMeta {
  /** The submission's document id - a local replay's id comes from it. */
  id: string;
  uid: string;
  /** The client's own score, 0-100. */
  hint: number;
  /** The ranked attempt it was declared as, if any (ADR 0012). */
  attempt?: string;
  /** The server time the submission was written at, in ms. */
  createdAt: number;
}

/** Where a submitted replay goes, and what its record says. */
export interface AcceptPlan {
  id: string;
  kind: ReplayKind;
  /** Online only: the room and the match number in it. */
  room?: { code: string; n: number };
  /**
   * Online only: a hash of what was played - the level, the seed, the
   * length and every input. Both devices record the same inputs, so two
   * reports agree only on the same match, not merely on its outcome.
   */
  inputsHash?: string;
  record: ReplayRecord;
}

/** The fields of `replays/{id}` that come from the replay itself. */
export interface ReplayRecord {
  kind: ReplayKind;
  levelId: string;
  balanceVersion: number;
  replayVersion: number;
  simulation: string;
  ticks: number;
  /**
   * The arena's cells, width times height: with `ticks` what a re-run
   * costs (`expectedRerunMs`), on whatever simulation resolution it was
   * played.
   */
  cells: number;
  endedBy: string;
  winnerSeat: number | null;
  checksum: number;
  hint: number;
  attempt?: { id: string; at: number };
}

/** Why a submission was dropped. */
export type Rejection =
  | 'not-vs-computer'
  | 'not-two-players'
  | 'attempt-mismatch'
  | 'no-outcome';

/**
 * Decides what a parsed, stored-strict replay is (ADR 0011, 0012):
 * - online when it names its room: the id is `onlineReplayId`, the same on
 *   both devices;
 * - else a local match, which must be against the computer: `l_` and the
 *   submission's id. `daily` when it plays the daily level of its attempt's
 *   day - or, without an attempt, of the day it arrived or the one before;
 *   `endless` when its attempt is an endless run's; `computer` otherwise.
 *   (An unranked endless match carries nothing that tells it from another
 *   generated level, so it is stored as `computer`.)
 */
export function planAcceptance(
  replay: Replay,
  submission: SubmissionMeta
): AcceptPlan | Rejection {
  const { header } = replay;
  if (header.outcome === undefined || header.checksum === undefined) {
    return 'no-outcome';
  }
  const attempt =
    submission.attempt === undefined
      ? null
      : parseAttemptId(submission.attempt);
  if (
    (submission.attempt !== undefined &&
      (attempt === null || header.attempt?.id !== submission.attempt)) ||
    (submission.attempt === undefined && header.attempt !== undefined)
  ) {
    return 'attempt-mismatch';
  }
  const record = (kind: ReplayKind): ReplayRecord => ({
    kind,
    levelId: header.levelId,
    balanceVersion: header.balanceVersion,
    replayVersion: header.version,
    simulation: header.simulation,
    ticks: header.ticks,
    cells: header.width * header.height,
    endedBy: header.outcome?.endedBy ?? 'none',
    winnerSeat: header.outcome?.winnerSeat ?? null,
    checksum: header.checksum ?? 0,
    hint: submission.hint,
    ...(header.attempt === undefined
      ? {}
      : { attempt: { id: header.attempt.id, at: header.attempt.at } }),
  });
  if (header.roomCode !== undefined && header.n !== undefined) {
    if (header.mode !== 'two-players' || attempt !== null) {
      return 'not-two-players';
    }
    return {
      id: onlineReplayId(header.roomCode, header.n, header.seed),
      kind: 'online',
      room: { code: header.roomCode, n: header.n },
      inputsHash: inputsHashOf(replay),
      record: record('online'),
    };
  }
  if (header.mode !== 'vs-computer') {
    return 'not-vs-computer';
  }
  const kind = localKind(header.levelId, attempt, submission.createdAt);
  return { id: `l_${submission.id}`, kind, record: record(kind) };
}

function localKind(
  levelId: string,
  attempt: ReturnType<typeof parseAttemptId>,
  arrivedAt: number
): ReplayKind {
  if (attempt?.kind === 'endless') {
    return 'endless';
  }
  const days =
    attempt?.kind === 'daily'
      ? [attempt.day]
      : [dayOf(arrivedAt), dayOf(arrivedAt - 24 * 3_600_000)];
  return days.some((day) => dailyLevelId(day) === levelId)
    ? 'daily'
    : 'computer';
}

/** See {@link AcceptPlan.inputsHash}. */
export function inputsHashOf({ header, inputs }: Replay): string {
  return createHash('sha256')
    .update(JSON.stringify([header.levelId, header.seed, header.ticks, inputs]))
    .digest('hex')
    .slice(0, 32);
}
