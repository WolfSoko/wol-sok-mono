import { DAY_MS } from '../boards/budgets';
import { NOT_REPORTED_AFTER_MS, REPLAY_TTL_MS, RETRY_FOR_MS } from '../config';

/**
 * How a stored replay forgets one player (ADR 0012, owner's decision of
 * 2026-10-26) - for the player's `forget` and for a deleted account alike.
 * Pure, so the specs check it without Firestore. A recorded match holds no
 * name; its blob holds no uid. What links it to a player is their uid in
 * `players` (who reads it, `listMine`), in the online seats and in
 * `optOut` - and the report under `reports/{uid}`, which `forget.ts`
 * deletes. The replay stays for the statistics, without them, until its
 * `expireAt`.
 */

/** The fields of `replays/{id}` the plan reads. */
export interface ForgettableReplay {
  players?: unknown;
  seats?: unknown;
  optOut?: unknown;
  expireAt?: unknown;
  /** When it was stored, in ms - null when unknown. */
  createdAt: number | null;
  kind?: unknown;
  state?: unknown;
  attempt?: unknown;
  rankedReason?: unknown;
}

/**
 * The changes that take `uid` out of the replay, or null when it does not
 * name them. The seat of an online match turns null, so the other player
 * keeps theirs. A replay that has no `expireAt` (one in the gallery keeps
 * none while public) gets its normal one back, at the earliest a day from
 * now: anonymised, it is kept 30 days after the match, not longer.
 */
export function forgetChanges(
  replay: ForgettableReplay,
  uid: string,
  now: number
): {
  players: string[];
  optOut: string[];
  seats?: (string | null)[];
  /** In ms - the caller writes it as a timestamp. */
  expireAt?: number;
} | null {
  const players = strings(replay.players);
  const optOut = strings(replay.optOut);
  const seats = Array.isArray(replay.seats)
    ? (replay.seats as unknown[]).map((seat) =>
        typeof seat === 'string' ? seat : null
      )
    : null;
  if (
    !players.includes(uid) &&
    !optOut.includes(uid) &&
    !(seats?.includes(uid) ?? false)
  ) {
    return null;
  }
  const born = replay.createdAt ?? now;
  return {
    players: players.filter((player) => player !== uid),
    optOut: optOut.filter((player) => player !== uid),
    ...(seats === null
      ? {}
      : { seats: seats.map((seat) => (seat === uid ? null : seat)) }),
    ...(replay.expireAt === undefined || replay.expireAt === null
      ? { expireAt: Math.max(born + REPLAY_TTL_MS, now + DAY_MS) }
      : {}),
  };
}

/**
 * True while the boards may still rank the replay (ADR 0012): a declared
 * attempt or an `agreed` online match that `rankReplay` has not answered
 * yet, within the time it keeps trying. The player's `forget` waits for
 * it: ranking reads the player from the replay. An account deletion does
 * not wait - its board entries go anyway.
 */
export function stillRanking(replay: ForgettableReplay, now: number): boolean {
  const ranked =
    replay.attempt !== undefined ||
    (replay.kind === 'online' && replay.state === 'agreed');
  return (
    ranked &&
    replay.rankedReason === undefined &&
    replay.createdAt !== null &&
    now - replay.createdAt < NOT_REPORTED_AFTER_MS + RETRY_FOR_MS
  );
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
