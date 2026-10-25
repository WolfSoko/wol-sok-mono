import { AVATAR_COUNT } from '../social/profile';
import { utcDay } from './daily';
import { MAX_TICKS } from './replay';

/**
 * The leaderboards' shared contract (ADR 0012): board ids, the one-number
 * scores, the cut sizes, the anonymous label and the XP caps. Pure, so the
 * client, the Cloud Functions and the admin lib all read the same rules.
 */

/** The kinds of board - one entry id per kind and player. */
export type BoardKind = 'xp' | 'online' | 'daily' | 'endless';

export const BOARD_KINDS: readonly BoardKind[] = [
  'xp',
  'online',
  'daily',
  'endless',
];

/** A board: the all-time ones by kind, a daily one by its UTC day. */
export type BoardId = 'xp' | 'online' | 'endless' | `daily-${string}`;

/** A board id taken apart. */
export type BoardRef =
  | { kind: 'xp' | 'online' | 'endless' }
  | { kind: 'daily'; day: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar day written as `YYYY-MM-DD`. */
export function isUtcDay(day: string): boolean {
  if (!DAY.test(day)) {
    return false;
  }
  const time = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(time) && utcDay(new Date(time)) === day;
}

/** The board of that UTC day's daily level. */
export function dailyBoardId(day: string): BoardId {
  if (!isUtcDay(day)) {
    throw new RangeError(`Not a UTC day: ${day}`);
  }
  return `daily-${day}`;
}

/** The kind (and day) of a board id - null for anything else. */
export function parseBoardId(id: string): BoardRef | null {
  if (id === 'xp' || id === 'online' || id === 'endless') {
    return { kind: id };
  }
  const day = id.startsWith('daily-') ? id.slice('daily-'.length) : null;
  return day !== null && isUtcDay(day) ? { kind: 'daily', day } : null;
}

export function isBoardId(id: string): id is BoardId {
  return parseBoardId(id) !== null;
}

// --- Entries ---------------------------------------------------------------

/** An entry's state; `hidden` ones are never shown to players. */
export type EntryStatus =
  | 'counted'
  | 'verified'
  | 'provisional'
  | 'stale'
  | 'hidden';

/** The statuses a board shows, in its queries' `status in [...]`. */
export const VISIBLE_STATUSES: readonly EntryStatus[] = [
  'counted',
  'verified',
  'provisional',
  'stale',
];

/** What a row shows besides its rank, per board kind. */
export type EntryShow =
  | { xp: number; rank: string }
  | { w: number; l: number; d: number; nr: number }
  | { ticks: number; won: boolean }
  | { depth: number; seconds: number; partial?: boolean };

/** A row of a board's top document. */
export interface BoardRow {
  entryId: string;
  sort: number;
  atHour: number;
  /** 1 + the visible entries with a higher `sort`. */
  pos: number;
  /** The verified rank, inside the cut only. */
  rank?: number;
  status: EntryStatus;
  /** The public name, or null for the anonymous label. */
  name: string | null;
  tag: number;
  avatar: number;
  show: EntryShow;
}

/** An entry document's shown fields: a row without its id and place. */
export type BoardEntry = Omit<BoardRow, 'entryId' | 'pos' | 'rank'>;

/** True for a status a board shows. */
export function isVisible(status: EntryStatus): boolean {
  return VISIBLE_STATUSES.includes(status);
}

/**
 * True when an entry may show its player's name: counted and verified
 * ones. A provisional or stale claim never does, so it is never a
 * billboard - the functions leave its name out already.
 */
export function showsName(status: EntryStatus): boolean {
  return status === 'counted' || status === 'verified';
}

/** A Firestore document id as entry ids are made: no slashes, short. */
const ENTRY_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function isEntryId(id: string): boolean {
  return ENTRY_ID.test(id);
}

// --- Scores ----------------------------------------------------------------
// Every score is one safe integer, higher is better, so a board needs one
// index and a rank is one `count()`.

/** The span of the inner score of `online` and `endless`. */
const SPAN_6 = 1_000_000;
const SPAN_7 = 10_000_000;

/** Board XP as it is: more is better. */
export function xpSort(xp: number): number {
  return checked(count(xp, 'xp'));
}

/**
 * `wins × 10⁶ + (10⁶ − 1 − losses)`: more wins first, then fewer losses.
 * Draws do not score. Losses past 999,999 all score alike.
 */
export function onlineSort(wins: number, losses: number): number {
  return checked(
    count(wins, 'wins') * SPAN_6 +
      (SPAN_6 - 1 - Math.min(count(losses, 'losses'), SPAN_6 - 1))
  );
}

/**
 * A daily attempt: a win scores `10⁷ + (MAX_TICKS − ticks)`, so faster is
 * better; a loss scores `ticks`, so holding on longer is better. Every win
 * beats every loss.
 */
export function dailySort(won: boolean, ticks: number): number {
  const length = count(ticks, 'ticks');
  if (length > MAX_TICKS) {
    throw new RangeError(`ticks past MAX_TICKS: ${ticks}`);
  }
  return won ? SPAN_7 + (MAX_TICKS - length) : length;
}

/**
 * An endless run: `depth × 10⁷ + (10⁷ − 1 − seconds)`, deeper first, then
 * fewer seconds spent on the winning matches. Seconds past 9,999,999 all
 * score alike.
 */
export function endlessSort(depth: number, seconds: number): number {
  return checked(
    count(depth, 'depth') * SPAN_7 +
      (SPAN_7 - 1 - Math.min(count(seconds, 'seconds'), SPAN_7 - 1))
  );
}

/** The hour a score was reached, in whole hours since the epoch. */
export function atHourOf(millis: number): number {
  return Math.floor(millis / 3_600_000);
}

/**
 * The display order of a board: higher `sort` first; among ties the score
 * reached earlier (`atHour`), then the entry id.
 */
export function compareRows(
  a: Pick<BoardRow, 'sort' | 'atHour' | 'entryId'>,
  b: Pick<BoardRow, 'sort' | 'atHour' | 'entryId'>
): number {
  if (a.sort !== b.sort) {
    return b.sort - a.sort;
  }
  if (a.atHour !== b.atHour) {
    return a.atHour - b.atHour;
  }
  return a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0;
}

/**
 * Competition ranks (1, 2, 2, 4) for scores in board order: a score's rank
 * is 1 + the scores above it.
 */
export function competitionRanks(sorts: readonly number[]): number[] {
  const ranks: number[] = [];
  sorts.forEach((sort, i) =>
    ranks.push(i > 0 && sorts[i - 1] === sort ? ranks[i - 1] : i + 1)
  );
  return ranks;
}

function count(value: number, what: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a whole number >= 0: ${value}`);
  }
  return value;
}

function checked(sort: number): number {
  if (!Number.isSafeInteger(sort)) {
    throw new RangeError(`Score past 2^53: ${sort}`);
  }
  return sort;
}

// --- Cuts ------------------------------------------------------------------

/** Rows a top document holds, already ordered. */
export const TOP_ROWS = 50;
/** Entries a further page of a board loads. */
export const PAGE_ROWS = 25;
/** Provisional entries the "Being checked" strip shows under the cut. */
export const CHECKING_ROWS = 5;
/** Provisional entries checked after the candidates for the cut. */
export const NEXT_CANDIDATES = 10;

/** Ranks that show only verified entries, per kind - 0 where none verify. */
export const BOARD_CUT: Readonly<Record<BoardKind, number>> = {
  xp: 0,
  online: 0,
  daily: 10,
  endless: 10,
};

// --- Names -----------------------------------------------------------------

/** Tags run from 0 to 9999, shown with four digits: "Anonymous #0042". */
export const TAG_COUNT = 10_000;

/**
 * The number of the anonymous label, derived from the board's entry id.
 * The label text itself is the game's (`boards.anonymous`).
 */
export function boardTag(entryId: string): number {
  return hashOf(entryId, 0x811c9dc5) % TAG_COUNT;
}

/** A tag as the label shows it, four digits. */
export function formatTag(tag: number): string {
  return String(tag).padStart(4, '0');
}

/** The preset avatar of an entry whose player shows none of their own. */
export function boardAvatar(entryId: string): number {
  return hashOf(entryId, 0x050c5d1f) % AVATAR_COUNT;
}

/** Names copying the anonymous label, English or German: "Anonym #4821". */
export const ANONYMOUS_NAME = /^\s*anonym(?:ous)?\s*#?\s*\d+\s*$/i;
/** Names copying `defaultProfile`'s "Player NNNN". */
export const DEFAULT_NAME = /^\s*player\s*#?\s*\d{4}\s*$/i;

/** True for a name that would pose as another row's label. */
export function posesAsLabel(name: string): boolean {
  return ANONYMOUS_NAME.test(name) || DEFAULT_NAME.test(name);
}

function hashOf(text: string, offset: number): number {
  let hash = offset;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  return (hash ^ (hash >>> 13)) >>> 0;
}

// --- XP caps ---------------------------------------------------------------

/** Board XP may always rise this much at once... */
export const XP_RISE_BASE = 2_000;
/** ...plus this much per hour since the last count... */
export const XP_RISE_PER_HOUR = 3_000;
/** ...and at most this much in gross rises per UTC day. */
export const XP_RISE_PER_DAY = 20_000;
/** The first count of a player from before the launch, at most. */
export const XP_FULL_COUNT = 25_000;
/**
 * Progress documents created before this moment (their server
 * `createTime`) get the full first count. The owner's cut (2026-10-24):
 * every account there is today counts in full, every later one starts at
 * the hourly cap.
 */
export const XP_FULL_COUNT_BEFORE = Date.UTC(2026, 9, 25);

/**
 * How far board XP may rise now: `min(2,000 + 3,000 × hours since the last
 * count, 20,000 − risen today)`, never below 0.
 */
export function xpRiseCap(hoursSinceLast: number, risenToday: number): number {
  const hours = Math.max(0, hoursSinceLast);
  return Math.max(
    0,
    Math.floor(
      Math.min(
        XP_RISE_BASE + XP_RISE_PER_HOUR * hours,
        XP_RISE_PER_DAY - risenToday
      )
    )
  );
}
