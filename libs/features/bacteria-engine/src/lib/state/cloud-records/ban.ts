import { BAN_REASONS, type BanReason } from '../admin-commands';
import { isObject } from '../is-object';

/**
 * A ban (ADR 0012) as `bans/{uid}` stores it, in ms: since when, until when
 * - null for good - and why. Only the functions write it; they, the game
 * and the admin read it with {@link parseBan}.
 */
export interface CloudBan {
  /** When it began - null when not readable. */
  since: number | null;
  /** When it ends by itself - null for good. */
  until: number | null;
  /** Why - null when not readable. */
  reason: BanReason | null;
}

/**
 * A stored time in ms, or null for anything that is none - each side maps
 * its own Firestore Timestamp, so Firebase stays out of the engine.
 */
export type ToMillis = (value: unknown) => number | null;

/**
 * `bans/{uid}` - null for no document. Read as the rules read it: a ban
 * whose `until` is null, missing or not a time holds for good, since the
 * rules' `notBanned()` frees a player only by a readable end.
 */
export function parseBan(data: unknown, toMillis: ToMillis): CloudBan | null {
  if (!isObject(data)) {
    return null;
  }
  return {
    since: toMillis(data['since']),
    until: data['until'] === null ? null : toMillis(data['until']),
    reason: BAN_REASONS.find((known) => known === data['reason']) ?? null,
  };
}

/**
 * True while a ban holds at `now`: a permanent one always, any other until
 * its end, exclusive - at `until` it holds no more, as the rules'
 * `notBanned()` (`until <= request.time`) and the Realtime Database rules
 * (`val() <= now`) take it.
 */
export function banHolds(
  ban: Pick<CloudBan, 'until'> | null,
  now: number
): boolean {
  return ban !== null && (ban.until === null || ban.until > now);
}

/**
 * The ban as the Realtime Database mirrors it in `bans/{uid}`: its end in
 * ms, `0` for good.
 */
export function mirroredBan(until: number | null): number {
  return until ?? 0;
}

/**
 * A mirrored ban (see {@link mirroredBan}) - null for none, or a value that
 * is no end. The mirror tells neither start nor reason.
 */
export function parseMirroredBan(value: unknown): CloudBan | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return { since: null, until: value === 0 ? null : value, reason: null };
}
