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
  /** When `closeNotReported` closes a `waiting` online match. */
  closeAt?: unknown;
  /** Set while a public copy of it is up. */
  publicId?: unknown;
}

/**
 * The changes that take `uid` out of the replay, or null when it does not
 * name them. The seat of an online match turns null, so the other player
 * keeps theirs. A replay still public (`publicId`) keeps no `expireAt`, so
 * TTL does not take it from under its public copy; `takeDownPublic` gives
 * it one when the copy comes down. Any other replay without an `expireAt`
 * gets its normal one back, at the earliest a day from now: anonymised, it
 * is kept 30 days after the match, not longer.
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
    ...((replay.expireAt === undefined || replay.expireAt === null) &&
    typeof replay.publicId !== 'string'
      ? { expireAt: anonymisedExpireAt(born, now) }
      : {}),
  };
}

/**
 * When a replay no longer public, or forgotten by a player, expires, in
 * ms: 30 days after the match (`born`), but at the earliest a day from
 * `now`.
 */
export function anonymisedExpireAt(born: number, now: number): number {
  return Math.max(born + REPLAY_TTL_MS, now + DAY_MS);
}

/**
 * True while the boards may still rank the replay (ADR 0012), so the
 * player's `forget` waits for it - ranking reads the player from the
 * replay, and a forget would dodge it:
 * - an online match still `waiting` for its second report, until
 *   `closeNotReported` closes it at its `closeAt`, however late that runs:
 *   a lone reporter who forgot would turn the other's late report into a
 *   dispute instead of a counted match, and a non-reporter who forgot
 *   would escape their "Not reported";
 * - a declared attempt, or an online match past `waiting` but not
 *   `disputed` (`agreed`, or `verified` by the gallery meanwhile), that
 *   `rankReplay` has not answered yet, within the time it keeps trying.
 * An account deletion does not wait: its board entries go anyway, so it
 * dodges nothing (ADR 0012, "Privacy").
 */
export function stillRanking(replay: ForgettableReplay, now: number): boolean {
  if (replay.rankedReason !== undefined) {
    return false;
  }
  if (replay.kind === 'online' && replay.state === 'waiting') {
    return replay.closeAt !== undefined && replay.closeAt !== null;
  }
  const ranked =
    replay.attempt !== undefined ||
    (replay.kind === 'online' && replay.state !== 'disputed');
  return (
    ranked &&
    replay.createdAt !== null &&
    now - replay.createdAt < NOT_REPORTED_AFTER_MS + RETRY_FOR_MS
  );
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
