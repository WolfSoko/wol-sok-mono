import { isObject } from './is-object';

/**
 * The command documents (ADR 0011, 0012): the client never calls a
 * function, it writes `replaySubmissions`, `replayCommands` or
 * `adminCommands` and a trigger runs it, writing `result` back on the
 * command. Their envelope, the replay commands and the result, shared by
 * the game, the admin and the functions. Pure.
 */

/** The fields every command document carries around its command. */
export const COMMAND_ENVELOPE_KEYS = ['uid', 'createdAt', 'expireAt'] as const;

/** The field the functions write a command's {@link CommandResult} into. */
const RESULT_KEY = 'result';

/**
 * How long a command document lives before TTL takes it: a day. The rules
 * (`isCommandExpiry`) take an `expireAt` in the future and less than two
 * days ahead, which leaves a day for a wrong client clock.
 */
export const COMMAND_TTL_MS = 24 * 60 * 60 * 1000;

/** The `expireAt` of a command written at `now`, in ms since the epoch. */
export function commandExpiresAt(now: number): number {
  return now + COMMAND_TTL_MS;
}

/**
 * True for a field of the stored document - its envelope and its result -
 * rather than of its command.
 */
export function isCommandDocumentKey(key: string): boolean {
  return (
    key === RESULT_KEY ||
    (COMMAND_ENVELOPE_KEYS as readonly string[]).includes(key)
  );
}

/**
 * What a player may ask of a replay: `remove` keeps it out of the public
 * gallery, `forget` takes them out of it - it stays anonymised for the
 * statistics (ADR 0012, owner's decision of 2026-10-26).
 */
export const PLAYER_REPLAY_COMMAND_TYPES = ['remove', 'forget'] as const;

/** The owner's gallery curation (ADR 0011), audited as `replay.<type>`. */
export const CURATION_COMMAND_TYPES = [
  'feature',
  'unfeature',
  'anonymise',
] as const;

/** Every type of `replayCommands/{id}`. */
export const REPLAY_COMMAND_TYPES = [
  ...PLAYER_REPLAY_COMMAND_TYPES,
  ...CURATION_COMMAND_TYPES,
] as const;

export type PlayerReplayCommandType =
  (typeof PLAYER_REPLAY_COMMAND_TYPES)[number];
export type CurationCommandType = (typeof CURATION_COMMAND_TYPES)[number];
export type ReplayCommandType = (typeof REPLAY_COMMAND_TYPES)[number];

/** A replay command without its envelope. */
export interface ReplayCommand {
  type: ReplayCommandType;
  replayId: string;
}

/** A replay id as the rules take it in a command. */
const REPLAY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * The fields of a replay command, and `claimed`, with which `forget` takes
 * its command once - a second delivery carries it.
 */
const REPLAY_COMMAND_KEYS = ['type', 'replayId', 'claimed'];

export function isCurationCommandType(
  type: ReplayCommandType
): type is CurationCommandType {
  return (CURATION_COMMAND_TYPES as readonly string[]).includes(type);
}

/**
 * Reads a replay command - null for anything that is not exactly one: an
 * unknown type, a missing or extra field, a replay id the rules would
 * refuse. The stored document's own fields may come along and are left
 * out of the result; the writer is the runner's to check.
 */
export function parseReplayCommand(value: unknown): ReplayCommand | null {
  if (!isObject(value)) {
    return null;
  }
  const { type, replayId } = value;
  if (
    Object.keys(value).some(
      (key) => !REPLAY_COMMAND_KEYS.includes(key) && !isCommandDocumentKey(key)
    ) ||
    typeof type !== 'string' ||
    !(REPLAY_COMMAND_TYPES as readonly string[]).includes(type) ||
    typeof replayId !== 'string' ||
    !REPLAY_ID.test(replayId)
  ) {
    return null;
  }
  return { type: type as ReplayCommandType, replayId };
}

/**
 * What the server made of a command, written back on it as `result` with
 * its time (`at`).
 */
export interface CommandResult {
  ok: boolean;
  /** Why not - an id such as `not-found`, never a text to show. */
  error?: string;
}

/** A command's stored result - null for none or one it cannot read. */
export function parseCommandResult(value: unknown): CommandResult | null {
  if (!isObject(value) || typeof value['ok'] !== 'boolean') {
    return null;
  }
  const { ok, error } = value;
  return typeof error === 'string' ? { ok, error } : { ok };
}
