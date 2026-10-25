import { BoardRow, CHECKING_ROWS } from '../state/boards';

/** The past daily boards the screen offers, today among them. */
export const DAILY_DAYS_SHOWN = 7;
/** Counted matches before the online row shows a win rate. */
export const WIN_RATE_AFTER = 10;

/** A board's rows in the screen's sections (ADR 0012, "Leaderboards screen"). */
export interface BoardSections {
  /** Inside the cut: verified entries only, by their verified rank. */
  verified: BoardRow[];
  /**
   * Provisional entries that would rank inside the cut, at most five,
   * shown by label only and without a number.
   */
  beingChecked: BoardRow[];
  /** Everyone else, by position - provisional and stale ones marked. */
  others: BoardRow[];
}

/**
 * Splits a board's rows into its sections. A board without a cut (rank,
 * online) has every row among the others.
 */
export function boardSections(
  rows: readonly BoardRow[],
  cut: number
): BoardSections {
  if (cut <= 0) {
    return { verified: [], beingChecked: [], others: [...rows] };
  }
  const verified = rows
    .filter((row) => row.rank !== undefined)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  // Above the last verified place, or anywhere while the cut is not full.
  const floor =
    verified.length < cut ? -Infinity : (verified.at(-1)?.sort ?? -Infinity);
  const beingChecked = rows
    .filter((row) => row.status === 'provisional' && row.sort > floor)
    .slice(0, CHECKING_ROWS);
  const shown = new Set([...verified, ...beingChecked]);
  return {
    verified,
    beingChecked,
    others: rows.filter((row) => !shown.has(row)),
  };
}
