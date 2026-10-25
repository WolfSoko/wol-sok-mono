import {
  ADMIN_COMMAND_TYPES,
  type AdminCommandType,
  BAN_REASONS,
  BOARD_KINDS,
  type BanReason,
  type BoardKind,
  type EntryShow,
  type EntryStatus,
  parseBoardId,
} from '@wolsok/feat-lazy-bac-game/admin-kit';

/**
 * The records the moderation views read (ADR 0012), as the functions write
 * them: bans, board memberships and entries, moderation counters and the
 * audit. Each parser keeps what it can read and drops the rest. Pure.
 */

/** What a stored profile shares beyond its card (`profiles/{uid}`). */
export interface ProfileFlags {
  /** The name shows on the boards; else the anonymous label. */
  publicName: boolean;
  boardOptOut: boolean;
  galleryOptOut: boolean;
}

/** `bans/{uid}`: since when, until when (null for good) and why. */
export interface BanRecord {
  uid: string;
  since: number;
  until: number | null;
  reason: BanReason;
}

/** One of a player's board entries, as `boardMembers/{uid}` points to it. */
export interface MemberEntryRef {
  boardId: string;
  kind: BoardKind;
  entryId: string;
}

/** `boardMembers/{uid}`: the entries, the kinds barred, the last activity. */
export interface MemberRecord {
  entries: MemberEntryRef[];
  barred: BoardKind[];
  activeAt: number | null;
}

/** Why an entry is hidden; any reason hides it. */
export const HIDE_REASONS = ['ban', 'admin', 'optout'] as const;
export type HideReason = (typeof HIDE_REASONS)[number];

/** `boards/{boardId}/entries/{entryId}`, as far as moderation needs it. */
export interface EntryRecord {
  status: EntryStatus | null;
  hiddenBy: HideReason[];
  /** The public name, null for the anonymous label. */
  name: string | null;
  sort: number | null;
}

/** A row of a board, as the leaderboards view lists it, hidden ones too. */
export interface BoardEntryRecord extends EntryRecord {
  entryId: string;
  /** The anonymous tag, `#0042`, shown where the entry has no name. */
  tag: number | null;
  /** The hour the entry was last ranked, in hours since the epoch. */
  atHour: number | null;
  show: EntryShow | null;
}

/** `moderation/{uid}`: how often the owner acted on the player. */
export const MODERATION_COUNTS = [
  'resets',
  'imageRemovals',
  'hides',
  'bans',
] as const;
export type ModerationCount = (typeof MODERATION_COUNTS)[number];
export type ModerationRecord = Record<ModerationCount, number>;

/** `adminAudit/{id}`: who did what to whom, and how it went. */
export interface AuditRecord {
  id: string;
  at: number | null;
  /** The owner's uid, or `system`. */
  by: string;
  type: string;
  /** The player's uid, once the command found one. */
  uid: string | null;
  /** The entry, for entry commands. */
  entry: { boardId: string; entryId: string } | null;
  reason: string;
  /** Null while the command runs. */
  ok: boolean | null;
  error: string | null;
  before: unknown;
  after: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Ms since the epoch from a Firestore `Timestamp` or a number. */
export function millisOf(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (isObject(value) && typeof value['toMillis'] === 'function') {
    const millis: unknown = (value as { toMillis: () => unknown }).toMillis();
    return typeof millis === 'number' ? millis : null;
  }
  return null;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

export function parseProfileFlags(value: unknown): ProfileFlags {
  const profile = isObject(value) ? value : {};
  return {
    publicName: profile['publicName'] === true,
    boardOptOut: profile['boardOptOut'] === true,
    galleryOptOut: profile['galleryOptOut'] === true,
  };
}

export function parseBan(uid: string, value: unknown): BanRecord | null {
  if (!isObject(value)) {
    return null;
  }
  const since = millisOf(value['since']);
  const until = value['until'] === null ? null : millisOf(value['until']);
  const reason = value['reason'];
  if (
    since === null ||
    (until === null && value['until'] !== null) ||
    !(BAN_REASONS as readonly unknown[]).includes(reason)
  ) {
    return null;
  }
  return { uid, since, until, reason: reason as BanReason };
}

/** True while the ban holds at `now`; the hourly sweep lifts the others. */
export function banHolds(ban: BanRecord, now: number): boolean {
  return ban.until === null || ban.until > now;
}

export function parseMember(value: unknown): MemberRecord {
  const member = isObject(value) ? value : {};
  const entryIds = isObject(member['entryIds']) ? member['entryIds'] : {};
  const boards = Array.isArray(member['boards']) ? member['boards'] : [];
  const entries = boards.flatMap((boardId): MemberEntryRef[] => {
    const board = typeof boardId === 'string' ? parseBoardId(boardId) : null;
    const entryId = board === null ? null : text(entryIds[board.kind]);
    return board === null || entryId === null
      ? []
      : [{ boardId: boardId as string, kind: board.kind, entryId }];
  });
  const barred = Array.isArray(member['barred']) ? member['barred'] : [];
  return {
    entries,
    barred: BOARD_KINDS.filter((kind) => barred.includes(kind)),
    activeAt: millisOf(member['activeAt']),
  };
}

const ENTRY_STATUSES: readonly EntryStatus[] = [
  'counted',
  'verified',
  'provisional',
  'stale',
  'hidden',
];

export function parseEntry(value: unknown): EntryRecord | null {
  if (!isObject(value)) {
    return null;
  }
  const status = value['status'];
  const hiddenBy = isObject(value['hiddenBy']) ? value['hiddenBy'] : {};
  const sort = value['sort'];
  return {
    status: (ENTRY_STATUSES as readonly unknown[]).includes(status)
      ? (status as EntryStatus)
      : null,
    hiddenBy: HIDE_REASONS.filter((reason) => hiddenBy[reason] === true),
    name: text(value['name']),
    sort: typeof sort === 'number' ? sort : null,
  };
}

export function parseBoardEntry(
  entryId: string,
  value: unknown
): BoardEntryRecord | null {
  const entry = parseEntry(value);
  if (entry === null || !isObject(value)) {
    return null;
  }
  const tag = value['tag'];
  const atHour = value['atHour'];
  return {
    ...entry,
    entryId,
    tag: typeof tag === 'number' ? tag : null,
    atHour: typeof atHour === 'number' ? atHour : null,
    show: isObject(value['show']) ? (value['show'] as EntryShow) : null,
  };
}

export function parseModeration(value: unknown): ModerationRecord {
  const counts = isObject(value) ? value : {};
  return Object.fromEntries(
    MODERATION_COUNTS.map((key) => {
      const count = counts[key];
      return [key, typeof count === 'number' ? count : 0];
    })
  ) as ModerationRecord;
}

export function parseAudit(id: string, value: unknown): AuditRecord | null {
  if (!isObject(value) || typeof value['type'] !== 'string') {
    return null;
  }
  const target = isObject(value['target']) ? value['target'] : {};
  const boardId = text(target['boardId']);
  const entryId = text(target['entryId']);
  const ok = value['ok'];
  return {
    id,
    at: millisOf(value['at']),
    by: text(value['by']) ?? '',
    type: value['type'],
    uid: text(target['uid']),
    entry: boardId === null || entryId === null ? null : { boardId, entryId },
    reason: text(value['reason']) ?? '',
    ok: typeof ok === 'boolean' ? ok : null,
    error: text(value['error']),
    before: value['before'] ?? null,
    after: value['after'] ?? null,
  };
}

/** The command types the audit can be filtered by. */
export const AUDIT_TYPES: readonly AdminCommandType[] = ADMIN_COMMAND_TYPES;
