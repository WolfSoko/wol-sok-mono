/**
 * Two players on one screen get a loop of their own: a series - the best of
 * three or five matches - and a head start that lets the stronger player
 * give the other a chance. Lifetime wins per colour are counted with the
 * progress (`couchWins`).
 */

/** How many matches a series is the best of - 1 for single matches. */
export type SeriesLength = 1 | 3 | 5;

export const SERIES_LENGTHS: readonly { id: SeriesLength; name: string }[] = [
  { id: 1, name: 'Single match' },
  { id: 3, name: 'Best of 3' },
  { id: 5, name: 'Best of 5' },
];

/** A series under way: how long it runs and what each seat has won. */
export interface Series {
  bestOf: SeriesLength;
  /** Wins of the left and the right seat. */
  wins: readonly [number, number];
}

/** A series about to begin. */
export function newSeries(bestOf: SeriesLength): Series {
  return { bestOf, wins: [0, 0] };
}

/** The wins that take a series. */
export function winsNeeded(bestOf: SeriesLength): number {
  return Math.floor(bestOf / 2) + 1;
}

/** The series after a match - a draw counts for nobody. */
export function addSeriesMatch(
  series: Series,
  winnerSeat: 0 | 1 | null
): Series {
  if (winnerSeat === null) {
    return series;
  }
  const wins: [number, number] = [...series.wins];
  wins[winnerSeat]++;
  return { ...series, wins };
}

/** The seat that has taken the series, null while it is open. */
export function seriesWinner(series: Series): 0 | 1 | null {
  const needed = winsNeeded(series.bestOf);
  const seat = series.wins.findIndex((wins) => wins >= needed);
  return seat === 0 || seat === 1 ? seat : null;
}

/**
 * Who starts bigger, from -2 to 2: below 0 the left seat, above 0 the
 * right one, 0 for an even start.
 */
export type HeadStart = -2 | -1 | 0 | 1 | 2;

export const HEAD_STARTS: readonly HeadStart[] = [-2, -1, 0, 1, 2];

/** How much each step of head start shrinks the other colony. */
const HEAD_START_STEP = 0.15;

/**
 * How each seat's colony starts, as a share of the level's start size: the
 * seat without the head start begins smaller, by a step per point.
 */
export function startScales(headStart: HeadStart): [number, number] {
  const behind = 1 - HEAD_START_STEP * Math.abs(headStart);
  if (headStart < 0) {
    return [1, behind];
  }
  if (headStart > 0) {
    return [behind, 1];
  }
  return [1, 1];
}

/** True for a head start the game offers. */
export function isHeadStart(value: unknown): value is HeadStart {
  return (HEAD_STARTS as readonly unknown[]).includes(value);
}

/** True for a series length the game offers. */
export function isSeriesLength(value: unknown): value is SeriesLength {
  return SERIES_LENGTHS.some(({ id }) => id === value);
}
