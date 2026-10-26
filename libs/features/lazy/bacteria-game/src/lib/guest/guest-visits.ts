import { isObject } from '../state/is-object';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The device keeps the guest's visits and notices under this key. */
export const GUEST_NOTICE_KEY = 'bacteria-game.guest-notice';
/**
 * The days a guest account may go unused before the functions delete it
 * (`GUEST_IDLE_DAYS` in `apps/bacteria-wars-functions/src/config.ts`).
 */
export const GUEST_IDLE_DAYS = 90;
/** The day the game was opened on this device from which a guest hears of it. */
export const NOTICE_FROM_DAY = 3;
/** How long "Later" puts the guest's notice away. */
export const NOTICE_DISMISSED_MS = 14 * DAY_MS;
/** A pause longer than this brings the notice back at once. */
export const COMEBACK_MS = 30 * DAY_MS;

/** What the device keeps of its visits and the notices it showed. */
export interface GuestVisits {
  /** The days the game was opened on this device. */
  readonly days: number;
  /** The last of them, as the device's local date (`2026-10-26`). */
  readonly lastDay: string | null;
  /** When the game was first opened on that day. */
  readonly lastAt: number | null;
  /** When the guest put the notice away, null for never. */
  readonly dismissedAt: number | null;
  /** True once the result screen offered the sign-in after a success. */
  readonly successHintShown: boolean;
}

const NO_VISITS: GuestVisits = {
  days: 0,
  lastDay: null,
  lastAt: null,
  dismissedAt: null,
  successHintShown: false,
};

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The visits from what the device stored, none from anything else. */
export function parseGuestVisits(stored: unknown): GuestVisits {
  if (!isObject(stored)) return NO_VISITS;
  const days = finiteOrNull(stored['days']);
  const lastDay = stored['lastDay'];
  return {
    days: days !== null && days > 0 ? Math.floor(days) : 0,
    lastDay: typeof lastDay === 'string' ? lastDay : null,
    lastAt: finiteOrNull(stored['lastAt']),
    dismissedAt: finiteOrNull(stored['dismissedAt']),
    successHintShown: stored['successHintShown'] === true,
  };
}

/** The device's local date of a moment, `2026-10-26`. */
export function localDay(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The visits with the game opened `now`: a day more on a new day, the same
 * visits again on a day already counted. After a pause of more than
 * {@link COMEBACK_MS} the guest `cameBack`, and a notice put away before
 * shows again.
 */
export function withVisit(
  visits: GuestVisits,
  now: number
): { visits: GuestVisits; cameBack: boolean } {
  const today = localDay(now);
  if (visits.lastDay === today) {
    return { visits, cameBack: false };
  }
  const cameBack = visits.lastAt !== null && now - visits.lastAt > COMEBACK_MS;
  return {
    visits: {
      ...visits,
      days: visits.days + 1,
      lastDay: today,
      lastAt: now,
      dismissedAt: cameBack ? null : visits.dismissedAt,
    },
    cameBack,
  };
}

/**
 * True when a guest should hear that an unused guest account is deleted:
 * from the {@link NOTICE_FROM_DAY}th day the game was opened, or at once
 * after a long pause - unless the notice was put away lately.
 */
export function noticeDue(
  visits: GuestVisits,
  cameBack: boolean,
  now: number
): boolean {
  if (!cameBack && visits.days < NOTICE_FROM_DAY) return false;
  // Either way round: a clock that was off when the notice was put away
  // still keeps it away for two weeks at most.
  return (
    visits.dismissedAt === null ||
    Math.abs(now - visits.dismissedAt) >= NOTICE_DISMISSED_MS
  );
}
