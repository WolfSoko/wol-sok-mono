import { isEntryId, parseBoardId } from './boards';
import { type FeatureToggles, parseToggleValues } from './feature-toggles';
import { isObject } from './is-object';

/**
 * The admin's command documents (ADR 0012, `adminCommands/{id}`): their
 * types, targets and arguments, and the parser the admin view and the
 * `adminCommand` function both check them with. Pure.
 */

export const ADMIN_COMMAND_TYPES = [
  'profile.reset',
  'profile.removeImage',
  'board.hideEntry',
  'board.hidePlayer',
  'board.restore',
  'board.verify',
  'player.ban',
  'player.unban',
  'stats.refresh',
  'stats.recount',
  'toggles.set',
] as const;

export type AdminCommandType = (typeof ADMIN_COMMAND_TYPES)[number];

/** Types that need a sign-in within the last hour (the rules check it). */
export const DESTRUCTIVE_COMMAND_TYPES: readonly AdminCommandType[] = [
  'profile.reset',
  'profile.removeImage',
  'board.hideEntry',
  'board.hidePlayer',
  'player.ban',
  'toggles.set',
];

/** Why a player is banned - also the reason of their notice. */
export const BAN_REASONS = [
  'cheating',
  'offensive-profile',
  'spam',
  'other',
] as const;

export type BanReason = (typeof BAN_REASONS)[number];

/** A player, by uid. */
export interface PlayerTarget {
  uid: string;
}

/** A board entry - the player behind it, for player-wide types. */
export interface EntryTarget {
  boardId: string;
  entryId: string;
}

/** The longest `reason` of a command. */
export const REASON_MAX = 200;

interface Command<T extends AdminCommandType, Target, Args> {
  type: T;
  target: Target;
  /** Why, 1 to 200 characters; optional for `stats.*`. */
  reason: string;
  args: Args;
}

type NoArgs = Record<string, never>;

export type AdminCommand =
  | Command<'profile.reset' | 'profile.removeImage', PlayerTarget, NoArgs>
  | Command<'board.hideEntry', EntryTarget, { bar?: boolean }>
  | Command<'board.hidePlayer', PlayerTarget | EntryTarget, { bar?: boolean }>
  | Command<'board.restore', PlayerTarget | EntryTarget, NoArgs>
  | Command<'board.verify', EntryTarget, NoArgs>
  | Command<
      'player.ban',
      PlayerTarget | EntryTarget,
      {
        /** The ban's end in ms since the epoch, null for permanent. */
        until: number | null;
        reason: BanReason;
      }
    >
  | Command<'player.unban', PlayerTarget, NoArgs>
  | Command<'stats.refresh' | 'stats.recount', null, NoArgs>
  | Command<
      'toggles.set',
      null,
      {
        /** The toggles to change, at least one. */
        values: Partial<FeatureToggles>;
      }
    >;

/** What a type takes: its targets and the arguments it allows. */
const SCHEMA: Readonly<
  Record<
    AdminCommandType,
    {
      targets: 'uid' | 'entry' | 'either' | 'none';
      args: readonly string[];
      /** True where the reason may be left out. */
      reasonOptional?: true;
    }
  >
> = {
  'profile.reset': { targets: 'uid', args: [] },
  'profile.removeImage': { targets: 'uid', args: [] },
  'board.hideEntry': { targets: 'entry', args: ['bar'] },
  'board.hidePlayer': { targets: 'either', args: ['bar'] },
  'board.restore': { targets: 'either', args: [] },
  'board.verify': { targets: 'entry', args: [] },
  'player.ban': { targets: 'either', args: ['until', 'reason'] },
  'player.unban': { targets: 'uid', args: [] },
  'stats.refresh': { targets: 'none', args: [], reasonOptional: true },
  'stats.recount': { targets: 'none', args: [], reasonOptional: true },
  'toggles.set': { targets: 'none', args: ['values'] },
};

/** The fields of the command itself. */
const COMMAND_KEYS = ['type', 'target', 'reason', 'args'];
/** The fields of the stored document around it, which the parser skips. */
const ENVELOPE_KEYS = ['uid', 'createdAt', 'expireAt', 'result'];

/** A Firebase Auth uid as this project makes them. */
const UID = /^[A-Za-z0-9]{1,128}$/;

export function isUid(value: unknown): value is string {
  return typeof value === 'string' && UID.test(value);
}

export function isAdminCommandType(value: unknown): value is AdminCommandType {
  return (
    typeof value === 'string' &&
    (ADMIN_COMMAND_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Reads an admin command - null for anything that is not exactly one: an
 * unknown type, a missing or extra field, a target or argument the type
 * does not take. The stored document's own fields (`uid`, `createdAt`,
 * `expireAt`, `result`) may come along and are left out of the result.
 * `until` may be ms since the epoch or a Firestore `Timestamp`.
 */
export function parseAdminCommand(value: unknown): AdminCommand | null {
  if (!isObject(value) || !isAdminCommandType(value['type'])) {
    return null;
  }
  const type = value['type'];
  const schema = SCHEMA[type];
  const optional = schema.reasonOptional === true;
  const keys = Object.keys(value);
  if (
    keys.some(
      (key) => !COMMAND_KEYS.includes(key) && !ENVELOPE_KEYS.includes(key)
    ) ||
    !('target' in value) ||
    !('args' in value) ||
    (!optional && !('reason' in value)) ||
    ('uid' in value && !isUid(value['uid']))
  ) {
    return null;
  }
  const reason = parseReason(value['reason'], optional);
  const target = parseTarget(value['target'], schema.targets, type);
  const args = parseArgs(value['args'], schema.args, type);
  if (reason === null || target === undefined || args === null) {
    return null;
  }
  return { type, target, reason, args } as AdminCommand;
}

function parseReason(value: unknown, optional: boolean): string | null {
  if (value === undefined) {
    return optional ? '' : null;
  }
  if (typeof value !== 'string' || value.length > REASON_MAX) {
    return null;
  }
  return optional || value.trim() !== '' ? value : null;
}

/** The target, null for none - undefined when the type does not take it. */
function parseTarget(
  value: unknown,
  takes: 'uid' | 'entry' | 'either' | 'none',
  type: AdminCommandType
): PlayerTarget | EntryTarget | null | undefined {
  if (takes === 'none') {
    return value === null ? null : undefined;
  }
  if (!isObject(value)) {
    return undefined;
  }
  const keys = Object.keys(value);
  if (
    takes !== 'entry' &&
    keys.length === 1 &&
    keys[0] === 'uid' &&
    isUid(value['uid'])
  ) {
    return { uid: value['uid'] };
  }
  if (
    takes !== 'uid' &&
    keys.length === 2 &&
    typeof value['boardId'] === 'string' &&
    typeof value['entryId'] === 'string' &&
    isEntryId(value['entryId'])
  ) {
    const board = parseBoardId(value['boardId']);
    // Only daily and endless entries are re-simulated.
    if (
      board === null ||
      (type === 'board.verify' &&
        board.kind !== 'daily' &&
        board.kind !== 'endless')
    ) {
      return undefined;
    }
    return { boardId: value['boardId'], entryId: value['entryId'] };
  }
  return undefined;
}

function parseArgs(
  value: unknown,
  allowed: readonly string[],
  type: AdminCommandType
): AdminCommand['args'] | null {
  if (
    !isObject(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    return null;
  }
  if (type === 'player.ban') {
    const until = parseUntil(value['until']);
    const reason = value['reason'];
    if (
      until === undefined ||
      typeof reason !== 'string' ||
      !(BAN_REASONS as readonly string[]).includes(reason)
    ) {
      return null;
    }
    return { until, reason: reason as BanReason };
  }
  if (type === 'toggles.set') {
    const values = parseToggleValues(value['values']);
    return values === null ? null : { values };
  }
  if ('bar' in value) {
    return typeof value['bar'] === 'boolean' ? { bar: value['bar'] } : null;
  }
  return {};
}

/** A ban's end in ms, null for permanent - undefined when unreadable. */
function parseUntil(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  const millis =
    isObject(value) && typeof value['toMillis'] === 'function'
      ? (value as { toMillis: () => unknown }).toMillis()
      : value;
  return Number.isSafeInteger(millis) && (millis as number) > 0
    ? (millis as number)
    : undefined;
}
