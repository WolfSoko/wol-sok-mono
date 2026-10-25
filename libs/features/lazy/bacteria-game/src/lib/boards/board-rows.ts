import {
  BOARD_CUT,
  BoardKind,
  BoardRow,
  CHECKING_ROWS,
  EntryShow,
} from '../state/boards';
import { TICKS_PER_SEC } from '../state/fixed-tick';

/** The past daily boards the screen offers, today among them. */
export const DAILY_DAYS_SHOWN = 7;
/** Counted matches before the online row shows a win rate. */
export const WIN_RATE_AFTER = 10;

/** The places at the top of a board that show only verified entries. */
export function boardCut(kind: BoardKind): number {
  return BOARD_CUT[kind];
}

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

/** What a row shows besides its label, by board - see `EntryShow`. */
export type ShowLine =
  | { kind: 'xp'; xp: number; rank: string }
  | { kind: 'online'; w: number; l: number; d: number; nr: number }
  | { kind: 'daily'; won: boolean; seconds: number }
  | { kind: 'endless'; depth: number; seconds: number; partial: boolean };

/** Tells apart what an entry shows. */
export function showLine(show: EntryShow): ShowLine {
  if ('xp' in show) {
    return { kind: 'xp', xp: show.xp, rank: show.rank };
  }
  if ('w' in show) {
    return { kind: 'online', ...show };
  }
  if ('won' in show) {
    return {
      kind: 'daily',
      won: show.won,
      seconds: Math.floor(show.ticks / TICKS_PER_SEC),
    };
  }
  return {
    kind: 'endless',
    depth: show.depth,
    seconds: show.seconds,
    partial: show.partial === true,
  };
}
