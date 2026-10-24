import { createHash } from 'node:crypto';
import type {
  Attempt,
  Replay,
  ReplayHeader,
} from '@wolsok/feat-lazy-bac-game/engine';
import type { Engine } from '../engine';
import { DAY_MS, dayOf } from '../time';
import type { ReplayKind } from './model';

/** The most a submission's bytes may hold - the rules' limit too. */
export const MAX_SUBMISSION_BYTES = 600_000;

/** A `replaySubmissions` document as the function reads it. */
export interface Submission {
  uid: string;
  bytes: Uint8Array;
  hint: number;
  /** The server time of the write, ms since the epoch. */
  createdAt: number;
  /** A declared attempt's id (ADR 0012). */
  attempt?: string;
}

interface TimestampLike {
  toMillis(): number;
}

/** A submission's fields - null when the rules should have refused it. */
export function parseSubmission(
  data: Record<string, unknown> | undefined
): Submission | null {
  if (data === undefined) {
    return null;
  }
  const { uid, bytes, hint, createdAt, attempt } = data;
  if (
    typeof uid !== 'string' ||
    uid === '' ||
    !(bytes instanceof Uint8Array) ||
    bytes.length === 0 ||
    bytes.length > MAX_SUBMISSION_BYTES ||
    typeof hint !== 'number' ||
    !(hint >= 0 && hint <= 100) ||
    !isTimestamp(createdAt) ||
    (attempt !== undefined && typeof attempt !== 'string')
  ) {
    return null;
  }
  return {
    uid,
    bytes,
    hint,
    createdAt: createdAt.toMillis(),
    ...(attempt === undefined ? {} : { attempt }),
  };
}

function isTimestamp(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TimestampLike).toMillis === 'function'
  );
}

/**
 * The kind of a stored replay, derived from what it is, never from a claim
 * (ADR 0011, changed by ADR 0012): online with a room; endless for a match
 * of a declared run; daily for the daily level of the attempt's day, or
 * without an attempt of the UTC day of arrival or the day before;
 * otherwise a match against the computer.
 */
export function deriveKind(
  engine: Engine,
  header: ReplayHeader,
  attempt: Attempt | null,
  arrivedAt: number
): ReplayKind {
  if (header.roomCode !== undefined) {
    return 'online';
  }
  if (attempt?.kind === 'endless') {
    return 'endless';
  }
  const days =
    attempt?.kind === 'daily'
      ? [attempt.day]
      : [dayOf(arrivedAt), dayOf(arrivedAt - DAY_MS)];
  return days.some((day) => engine.dailyLevelId(day) === header.levelId)
    ? 'daily'
    : 'computer';
}

/** A hash of the inputs as played - both devices of an online match record the same. */
export function inputsHash(replay: Replay): string {
  return createHash('sha256')
    .update(JSON.stringify(replay.inputs))
    .digest('hex')
    .slice(0, 32);
}

/** Durations a match falls into in the level statistics, by its upper end in seconds. */
const DURATION_BUCKETS: readonly [number, string][] = [
  [60, 'lt1m'],
  [120, 'lt2m'],
  [180, 'lt3m'],
  [300, 'lt5m'],
  [600, 'lt10m'],
  [Infinity, 'ge10m'],
];

/**
 * The document of the level statistics a local replay counts into (ADR
 * 0016): a ladder level by its id, a generated one by its style and heat -
 * every roll is a level of its own, which no table would follow - and the
 * daily and endless levels apart. Per bot difficulty.
 */
export function levelStatsId(
  header: { levelId: string; difficulty: string },
  kind: ReplayKind
): string {
  const generated = /^gen:([a-z]+):\d+:(\d+)$/.exec(header.levelId);
  const level =
    generated === null
      ? header.levelId
      : kind === 'daily' || kind === 'endless'
        ? `${kind}-${generated[2]}`
        : `gen-${generated[1]}-${generated[2]}`;
  return `${level}_${header.difficulty}`;
}

/**
 * What a local replay adds to its level statistics, as field paths and
 * increments: no uid, increments only. Online matches have no computer and
 * count nowhere here.
 */
export function levelStatsIncrements(
  replay: Replay,
  ticksPerSec: number,
  /** True for a replay with evolution in it - the engine's `playsEvolution`. */
  evolved: boolean
): Record<string, number> {
  const { header } = replay;
  const winner = header.outcome?.winnerSeat ?? null;
  const result = winner === null ? 'draws' : winner === 0 ? 'wins' : 'losses';
  const seconds = header.ticks / ticksPerSec;
  const bucket = DURATION_BUCKETS.find(([upTo]) => seconds < upTo)?.[1];
  const increments: Record<string, number> = {
    attempts: 1,
    [result]: 1,
    [`durations.${bucket}`]: 1,
  };
  if (header.outcome?.endedBy === 'forfeit') {
    increments['quits'] = 1;
  }
  if (evolved) {
    increments['evolved'] = 1;
  }
  if (winner === 0) {
    increments[evolved ? 'evolvedWins' : 'plainWins'] = 1;
  }
  const weapon = header.loadouts?.[0]?.weapon;
  if (weapon != null) {
    increments[`weapons.${weapon}`] = 1;
  }
  return increments;
}
