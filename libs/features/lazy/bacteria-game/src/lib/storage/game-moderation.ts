import {
  combineLatest,
  concat,
  defer,
  distinctUntilChanged,
  map,
  type Observable,
  of,
  switchMap,
  timer,
} from 'rxjs';
import { BAN_REASONS, type BanReason } from '../state/admin-commands';
import { isObject } from '../state/is-object';
import { millisOf } from './firestore-values';

/**
 * A ban holding a player (ADR 0012), as they may read it: since when, until
 * when - null for good - and why. The owner who set it is never in it.
 */
export interface PlayerBan {
  /** When it began, in ms - null when not known (the mirror tells no start). */
  since: number | null;
  /** When it ends by itself, in ms - null for a permanent ban. */
  until: number | null;
  /** Why - null when not known (the mirror tells no reason). */
  reason: BanReason | null;
}

/** What the owner's actions tell a player - the functions' `NoticeType`. */
export const NOTICE_TYPES = [
  'profile-reset',
  'image-removed',
  'board-hidden',
  'banned',
  'unbanned',
] as const;

export type NoticeType = (typeof NOTICE_TYPES)[number];

/** A notice in `players/{uid}/notices/{id}`, which the player reads and deletes. */
export interface PlayerNotice {
  id: string;
  type: NoticeType;
  /** When the owner acted, in ms. */
  at: number;
  /** A ban's end, in ms, null for good - on `banned` only. */
  until?: number | null;
  /** A ban's reason - on `banned` only. */
  reason?: BanReason;
}

/**
 * The owner's moderation as it reaches the player (ADR 0012): their own
 * ban, read from `bans/{uid}` and its Realtime Database mirror, and the
 * notices the functions leave them. Written by the functions only; the
 * player reads both and deletes notices. Asked of `GameCloud.moderation()`
 * - null without the game's project, where nobody is banned. Everything
 * follows whoever plays, and listens only once a player is signed in.
 */
export interface GameModeration {
  /**
   * The ban holding the player now - null while none does - again when it
   * changes, and null once it ends by itself at its `until`. Emits once the
   * ban was read; never errors (a ban it cannot read is none).
   */
  ban(): Observable<PlayerBan | null>;
  /** The player's notices, oldest first; never errors. */
  notices(): Observable<PlayerNotice[]>;
  /** Deletes a notice the player has read. */
  dismiss(id: string): Promise<void>;
}

/** A ban as `bans/{uid}` stores it - null for none, or none it can read. */
export function parseBan(value: unknown): PlayerBan | null {
  if (!isObject(value)) {
    return null;
  }
  const until = value['until'] === null ? null : timeOf(value['until']);
  if (until === undefined) {
    return null;
  }
  return {
    since: timeOf(value['since']) ?? null,
    until,
    reason: banReasonOf(value['reason']),
  };
}

/**
 * The ban the Realtime Database mirrors (`bans/{uid}`, its end in ms, `0`
 * for good) - null for none.
 */
export function parseMirroredBan(value: unknown): PlayerBan | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return { since: null, until: value === 0 ? null : value, reason: null };
}

/**
 * True while a ban holds at `now`: a permanent one always, any other
 * until its end - exclusive, as the rules' `notBanned()` takes the end.
 */
export function banHolds(ban: PlayerBan | null, now: number): boolean {
  return ban !== null && (ban.until === null || ban.until > now);
}

/**
 * The ban holding the player at `now`, from the stored ban and its mirror:
 * the stored one, which says why, while it holds - else the mirror, while
 * it does. They part only while the functions write one after the other.
 */
export function holdingBan(
  stored: PlayerBan | null,
  mirror: PlayerBan | null,
  now: number
): PlayerBan | null {
  if (banHolds(stored, now)) {
    return stored;
  }
  return banHolds(mirror, now) ? mirror : null;
}

/** A notice as stored - null for anything that is not one. */
export function parseNotice(id: string, value: unknown): PlayerNotice | null {
  if (!isObject(value)) {
    return null;
  }
  const type = NOTICE_TYPES.find((known) => known === value['type']);
  const at = timeOf(value['at']);
  if (type === undefined || at === undefined) {
    return null;
  }
  if (type !== 'banned') {
    return { id, type, at };
  }
  const until = value['until'] === null ? null : timeOf(value['until']);
  const reason = banReasonOf(value['reason']);
  return {
    id,
    type,
    at,
    ...(until === undefined ? {} : { until }),
    ...(reason === null ? {} : { reason }),
  };
}

/** The longest wait a browser timer takes: a longer one fires at once. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * The ban holding the player as the stored ban and its mirror change - and
 * null once it ended by itself, which no document tells. Waits in steps a
 * browser timer can take, so a ban of weeks does not end at once.
 */
export function holdingBans(
  stored: Observable<PlayerBan | null>,
  mirror: Observable<PlayerBan | null>,
  now: () => number = Date.now
): Observable<PlayerBan | null> {
  return combineLatest([stored, mirror]).pipe(
    switchMap(([own, mirrored]) => {
      const holding = () => holdingBan(own, mirrored, now());
      const until$ = (): Observable<PlayerBan | null> =>
        defer(() => {
          const ban = holding();
          if (ban === null || ban.until === null) {
            return of(ban);
          }
          // It holds, so its end lies ahead: the ban now, and asked again
          // once the end - or a timer's longest step - has passed.
          const left = ban.until - now();
          return concat(
            of(ban),
            timer(Math.min(left, MAX_TIMER_MS)).pipe(switchMap(() => until$()))
          );
        });
      return until$();
    }),
    distinctUntilChanged(sameBan)
  );
}

function sameBan(a: PlayerBan | null, b: PlayerBan | null): boolean {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.since === b.since &&
      a.until === b.until &&
      a.reason === b.reason)
  );
}

/** Whether a ban holds, as the backends hold the player's writes by it. */
export function banned(
  bans: Observable<PlayerBan | null>
): Observable<boolean> {
  return bans.pipe(
    map((ban) => ban !== null),
    distinctUntilChanged()
  );
}

function banReasonOf(value: unknown): BanReason | null {
  return BAN_REASONS.find((known) => known === value) ?? null;
}

/** A Firestore timestamp (or ms) in ms - undefined for anything else. */
function timeOf(value: unknown): number | undefined {
  return millisOf(value, { numbers: true }) ?? undefined;
}
