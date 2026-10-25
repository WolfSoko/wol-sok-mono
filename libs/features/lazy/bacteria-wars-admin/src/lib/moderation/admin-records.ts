import {
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
  /** The replay, for the gallery's curation. */
  replayId: string | null;
  reason: string;
  /** Null while the command runs. */
  ok: boolean | null;
  error: string | null;
  before: unknown;
  after: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A finite number, else null. */
const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Ms since the epoch from a Firestore `Timestamp` or a number. */
export function millisOf(value: unknown): number | null {
  if (typeof value === 'number') {
    return numberOrNull(value);
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
  return {
    ...entry,
    entryId,
    tag: typeof tag === 'number' ? tag : null,
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
    replayId: text(target['replayId']),
    reason: text(value['reason']) ?? '',
    ok: typeof ok === 'boolean' ? ok : null,
    error: text(value['error']),
    before: value['before'] ?? null,
    after: value['after'] ?? null,
  };
}

/** A runner-up of the gallery's daily pick (`replayCandidates/{day}`). */
export interface CandidateRecord {
  replayId: string;
  kind: string;
  levelId: string;
  score: number | null;
  reasons: string[];
}

/** One day of `featureBest`: what it published and the runners-up. */
export interface CandidateDayRecord {
  day: string;
  checked: number;
  published: string[];
  candidates: CandidateRecord[];
}

/** A public replay (`publicReplays/{id}`), as the Replays view lists it. */
export interface PublicReplayRecord {
  publicId: string;
  replayId: string;
  kind: string;
  levelId: string;
  /** The seats as the public page shows them: a name, or the label. */
  players: string[];
  score: number | null;
  featuredAt: number | null;
  featuredBy: 'auto' | 'admin' | null;
  anonymised: boolean;
}

/** A stored replay (`replays/{id}`), as far as curating it needs. */
export interface StoredReplayRecord {
  replayId: string;
  state: string | null;
  kind: string | null;
  levelId: string | null;
  score: number | null;
  publicId: string | null;
  galleryOut: boolean;
}

const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const strings = (value: unknown): string[] =>
  array(value).filter((item): item is string => typeof item === 'string');

export function parseCandidateDay(
  day: string,
  value: unknown
): CandidateDayRecord | null {
  if (!isObject(value)) {
    return null;
  }
  const candidates = array(value['candidates']);
  return {
    day,
    checked: numberOrNull(value['checked']) ?? 0,
    published: strings(value['published']),
    candidates: candidates.flatMap((candidate): CandidateRecord[] => {
      if (!isObject(candidate) || typeof candidate['replayId'] !== 'string') {
        return [];
      }
      return [
        {
          replayId: candidate['replayId'],
          kind: text(candidate['kind']) ?? '',
          levelId: text(candidate['levelId']) ?? '',
          score: numberOrNull(candidate['score']),
          reasons: strings(candidate['reasons']),
        },
      ];
    }),
  };
}

export function parsePublicReplay(
  publicId: string,
  value: unknown
): PublicReplayRecord | null {
  if (!isObject(value) || typeof value['replayId'] !== 'string') {
    return null;
  }
  const players = array(value['players']);
  const featuredBy = value['featuredBy'];
  return {
    publicId,
    replayId: value['replayId'],
    kind: text(value['kind']) ?? '',
    levelId: text(value['levelId']) ?? '',
    players: players.map((player) =>
      isObject(player)
        ? (text(player['name']) ?? text(player['label']) ?? '?')
        : '?'
    ),
    score: numberOrNull(value['score']),
    featuredAt: millisOf(value['featuredAt']),
    featuredBy:
      featuredBy === 'auto' || featuredBy === 'admin' ? featuredBy : null,
    anonymised: value['anonymised'] === true,
  };
}

export function parseStoredReplay(
  replayId: string,
  value: unknown
): StoredReplayRecord | null {
  if (!isObject(value)) {
    return null;
  }
  return {
    replayId,
    state: text(value['state']),
    kind: text(value['kind']),
    levelId: text(value['levelId']),
    score: numberOrNull(value['score']),
    publicId: text(value['publicId']),
    galleryOut: value['galleryOut'] === true,
  };
}

/**
 * `levelStats/{id}` (ADR 0016): how a level went against one computer -
 * attempts, results, durations, evolved play and weapons, and the
 * medallions of the matches the server re-ran.
 */
export interface LevelStatsRecord {
  id: string;
  level: string;
  difficulty: string;
  balanceVersion: number | null;
  /** The ladder's version, 0 for a computer off the curve. */
  ladder: number;
  attempts: number;
  wins: number;
  losses: number;
  draws: number;
  /** Attempts with genes or a weapon in the player's own loadout. */
  evolved: number;
  plainWins: number;
  evolvedWins: number;
  /** Attempts per duration bucket (`lt1m` ... `ge10m`). */
  durations: Record<string, number>;
  /** Evolved attempts per weapon carried. */
  weapons: Record<string, number>;
  /** Matches the server re-ran, and the best medallion each earned. */
  rerun: number;
  medals: Record<string, number>;
}

/** A map of counters, the numbers only. */
const counts = (value: unknown): Record<string, number> =>
  isObject(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isFinite(entry[1])
        )
      )
    : {};

export function parseLevelStats(
  id: string,
  value: unknown
): LevelStatsRecord | null {
  if (!isObject(value) || typeof value['level'] !== 'string') {
    return null;
  }
  const count = (key: string) => numberOrNull(value[key]) ?? 0;
  return {
    id,
    level: value['level'],
    difficulty: text(value['difficulty']) ?? '',
    balanceVersion: numberOrNull(value['balanceVersion']),
    ladder: count('ladder'),
    attempts: count('attempts'),
    wins: count('wins'),
    losses: count('losses'),
    draws: count('draws'),
    evolved: count('evolved'),
    plainWins: count('plainWins'),
    evolvedWins: count('evolvedWins'),
    durations: counts(value['durations']),
    weapons: counts(value['weapons']),
    rerun: count('rerun'),
    medals: counts(value['medals']),
  };
}
