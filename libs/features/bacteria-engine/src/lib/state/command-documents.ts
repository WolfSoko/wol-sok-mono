import { isEntryId } from './boards';
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

/** The stored document's own fields: its envelope and its result. */
const DOCUMENT_KEYS: readonly string[] = [...COMMAND_ENVELOPE_KEYS, RESULT_KEY];

/**
 * True when every field of a stored command is one of `commandKeys` or the
 * document's own (envelope, result) - the "exactly one command" check
 * both parsers start with.
 */
export function hasOnlyCommandKeys(
  value: Record<string, unknown>,
  commandKeys: readonly string[]
): boolean {
  return Object.keys(value).every(
    (key) => commandKeys.includes(key) || DOCUMENT_KEYS.includes(key)
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

export type CurationCommandType = (typeof CURATION_COMMAND_TYPES)[number];
export type ReplayCommandType = (typeof REPLAY_COMMAND_TYPES)[number];

/** A replay command without its envelope. */
export interface ReplayCommand {
  type: ReplayCommandType;
  replayId: string;
}

const REPLAY_COMMAND_KEYS = ['type', 'replayId'];

export function isCurationCommandType(
  type: ReplayCommandType
): type is CurationCommandType {
  return (CURATION_COMMAND_TYPES as readonly string[]).includes(type);
}

/**
 * Reads a replay command - null for anything that is not exactly one: an
 * unknown type, a missing or extra field, a replay id the rules would
 * refuse (a document id as `isEntryId` takes it). The stored document's own fields may come along and are left
 * out of the result; the writer is the runner's to check.
 */
export function parseReplayCommand(value: unknown): ReplayCommand | null {
  if (!isObject(value)) {
    return null;
  }
  const { type, replayId } = value;
  if (
    !hasOnlyCommandKeys(value, REPLAY_COMMAND_KEYS) ||
    typeof type !== 'string' ||
    !(REPLAY_COMMAND_TYPES as readonly string[]).includes(type) ||
    typeof replayId !== 'string' ||
    !isEntryId(replayId)
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
