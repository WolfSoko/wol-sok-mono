import {
  XP_FULL_COUNT,
  XP_FULL_COUNT_BEFORE,
  xpRiseCap,
} from '@wolsok/feat-lazy-bac-game/engine';
import { dayOf } from '../limits';

/** What the XP board has counted of a player (`boardMembers/{uid}.xp`). */
export interface XpLedger {
  /** The board XP. */
  counted: number;
  /** The XP the stored progress claimed at the last count. */
  claimed: number;
  /** When the last count was, in ms. */
  lastAt: number;
  /** When the first count was, in ms. */
  firstAt: number;
  /** The gross rises of `todayDay` - a fall gives no room back. */
  risenToday: number;
  todayDay: string;
}

/**
 * The next count of a player's board XP (ADR 0012), from the XP their
 * stored progress claims:
 * - at or below the board XP, the board follows it down (a reset lowers it);
 * - above, it rises by at most `xpRiseCap` - 2,000 + 3,000 an hour since the
 *   last count, and 20,000 in gross rises a UTC day;
 * - the first count of a progress stored before the boards
 *   (`XP_FULL_COUNT_BEFORE`, by the document's server `createTime`) may take
 *   up to 25,000 at once; every other first count starts at the cap.
 *
 * XP still above the cap waits for the next progress write.
 */
export function nextXp(
  ledger: XpLedger | null,
  claimed: number,
  now: number,
  progressCreatedAt: number
): XpLedger {
  const today = dayOf(now);
  const risenToday =
    ledger !== null && ledger.todayDay === today ? ledger.risenToday : 0;
  const counted = ledger?.counted ?? 0;
  if (claimed <= counted) {
    return {
      counted: claimed,
      claimed,
      lastAt: now,
      firstAt: ledger?.firstAt ?? now,
      risenToday,
      todayDay: today,
    };
  }
  const cap =
    ledger === null
      ? progressCreatedAt < XP_FULL_COUNT_BEFORE
        ? XP_FULL_COUNT
        : xpRiseCap(0, risenToday)
      : xpRiseCap((now - ledger.lastAt) / 3_600_000, risenToday);
  const rise = Math.min(claimed - counted, Math.max(0, cap));
  return {
    counted: counted + rise,
    claimed,
    lastAt: now,
    firstAt: ledger?.firstAt ?? now,
    risenToday: risenToday + rise,
    todayDay: today,
  };
}

/** A stored ledger, as far as it can be read - null for none. */
export function parseLedger(value: unknown): XpLedger | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const v = value as Record<string, unknown>;
  const numbers = ['counted', 'claimed', 'lastAt', 'firstAt', 'risenToday'];
  if (
    numbers.some((key) => typeof v[key] !== 'number') ||
    typeof v['todayDay'] !== 'string'
  ) {
    return null;
  }
  return v as unknown as XpLedger;
}
