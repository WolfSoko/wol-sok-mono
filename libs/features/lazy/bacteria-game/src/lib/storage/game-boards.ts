import type { Observable } from 'rxjs';
import {
  BOARD_KINDS,
  type BoardEntry,
  type BoardKind,
  type BoardRow,
  ENTRY_STATUSES,
  type EntryShow,
} from '../state/boards';
import { isObject } from '../state/is-object';

/**
 * A board's top document, `boards/{boardId}`, as `rebuildTop` writes it:
 * the top rows already ordered, with their positions and, inside the cut,
 * the verified ranks (ADR 0012).
 */
export interface BoardTop {
  /** The places that show only verified entries - 0 where none verify. */
  cut: number;
  rows: BoardRow[];
  /** True once a daily board's day is over and checked: it changes no more. */
  final: boolean;
}

/** Where a further page of a board starts: after this entry. */
export interface BoardCursor {
  sort: number;
  atHour: number;
  entryId: string;
}

/** A board entry with its id, as a page lists it. */
export type PagedEntry = BoardEntry & { entryId: string };

/** What `boardMembers/{uid}` tells the player about their own entries. */
export interface BoardMember {
  /** One entry id per kind - the same on every daily board. */
  entryIds: Partial<Record<BoardKind, string>>;
  /** The boards the player has an entry on. */
  boards: string[];
  /** The kinds the owner hides the player's entries on. */
  barred: BoardKind[];
}

/** The player's own entry: shown, hidden from them, or not there. */
export type OwnEntry =
  | { state: 'shown'; entry: BoardEntry }
  | { state: 'hidden' }
  | { state: 'missing' };

/**
 * The leaderboards as the game reads them (ADR 0012, "Reading a board") -
 * written by the functions only, asked of `GameCloud.boards()`, null
 * without the game's Firebase project.
 */
export interface GameBoards {
  /**
   * A board's top document, again whenever it changes - null while it has
   * none. Errors when it cannot be read.
   */
  watchTop(boardId: string): Observable<BoardTop | null>;
  /** The visible entries after `after`, in display order, at most `limit`. */
  page(
    boardId: string,
    after: BoardCursor,
    limit: number
  ): Promise<PagedEntry[]>;
  /** The player's membership - null before their first entry. */
  member(uid: string): Promise<BoardMember | null>;
  /**
   * An entry of the player's: a hidden one is not theirs to read, so a
   * refusal reads as hidden; a missing one (deleted, or never written)
   * reads as missing.
   */
  entry(boardId: string, entryId: string): Promise<OwnEntry>;
  /** How many visible entries score more than `sort`. */
  countAbove(boardId: string, sort: number): Promise<number>;
}

/**
 * An entry as stored - null for anything that is not one. The functions'
 * own fields (`baseStatus`, `hiddenBy`, the times) are left out.
 */
export function parseBoardEntry(value: unknown): BoardEntry | null {
  if (!isObject(value)) {
    return null;
  }
  const { sort, atHour, tag, avatar, name } = value;
  const status = ENTRY_STATUSES.find((known) => known === value['status']);
  const show = parseShow(value['show']);
  if (
    typeof sort !== 'number' ||
    typeof atHour !== 'number' ||
    status === undefined ||
    show === null
  ) {
    return null;
  }
  return {
    sort,
    atHour,
    status,
    name: typeof name === 'string' && name !== '' ? name : null,
    tag: typeof tag === 'number' && Number.isInteger(tag) ? tag : 0,
    avatar: typeof avatar === 'number' && Number.isInteger(avatar) ? avatar : 0,
    show,
  };
}

/** A top document as stored - null for anything that is not one. */
export function parseBoardTop(value: unknown): BoardTop | null {
  if (!isObject(value) || !Array.isArray(value['rows'])) {
    return null;
  }
  const rows = value['rows'].flatMap((row: unknown): BoardRow[] => {
    const entry = parseBoardEntry(row);
    if (
      entry === null ||
      !isObject(row) ||
      typeof row['entryId'] !== 'string'
    ) {
      return [];
    }
    const pos = typeof row['pos'] === 'number' ? row['pos'] : 0;
    const rank = row['rank'];
    return [
      {
        ...entry,
        entryId: row['entryId'],
        pos,
        ...(typeof rank === 'number' ? { rank } : {}),
      },
    ];
  });
  return {
    cut: typeof value['cut'] === 'number' ? value['cut'] : 0,
    rows,
    final: value['final'] === true,
  };
}

/** The player's membership from `boardMembers/{uid}` - null for none. */
export function parseBoardMember(value: unknown): BoardMember | null {
  if (!isObject(value)) {
    return null;
  }
  const ids = isObject(value['entryIds']) ? value['entryIds'] : {};
  const boards = Array.isArray(value['boards']) ? value['boards'] : [];
  const barred = Array.isArray(value['barred']) ? value['barred'] : [];
  return {
    entryIds: Object.fromEntries(
      BOARD_KINDS.flatMap((kind) =>
        typeof ids[kind] === 'string' ? [[kind, ids[kind]]] : []
      )
    ),
    boards: boards.filter((id): id is string => typeof id === 'string'),
    barred: BOARD_KINDS.filter((kind) => barred.includes(kind)),
  };
}

function parseShow(value: unknown): EntryShow | null {
  if (!isObject(value)) {
    return null;
  }
  const number = (key: string) =>
    typeof value[key] === 'number' ? (value[key] as number) : 0;
  if ('xp' in value) {
    return {
      xp: number('xp'),
      rank: typeof value['rank'] === 'string' ? value['rank'] : '',
    };
  }
  if ('w' in value) {
    return { w: number('w'), l: number('l'), d: number('d'), nr: number('nr') };
  }
  if ('won' in value) {
    return { ticks: number('ticks'), won: value['won'] === true };
  }
  if ('depth' in value) {
    return {
      depth: number('depth'),
      seconds: number('seconds'),
      ...(value['partial'] === true ? { partial: true } : {}),
    };
  }
  return null;
}
