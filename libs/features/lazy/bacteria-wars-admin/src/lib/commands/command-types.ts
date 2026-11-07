import {
  ADMIN_COMMAND_TYPES,
  type AdminCommandType,
  CURATION_COMMAND_TYPES,
  type CurationCommandType,
} from '@wolsok/feat-lazy-bac-game/admin-kit';

/** Curation the owner cannot take back, so it needs a fresh sign-in. */
export const DESTRUCTIVE_REPLAY_TYPES: readonly CurationCommandType[] = [
  'unfeature',
  'anonymise',
];

/**
 * Everything the owner does, as the audit names it: the admin commands and
 * the curation, which `replayCommand` audits as `replay.<type>`.
 */
export type OwnerActionType =
  | AdminCommandType
  | `replay.${CurationCommandType}`;

export const OWNER_ACTION_TYPES: readonly OwnerActionType[] = [
  ...ADMIN_COMMAND_TYPES,
  ...CURATION_COMMAND_TYPES.map((type) => `replay.${type}` as const),
];

export function isOwnerActionType(type: string): type is OwnerActionType {
  return (OWNER_ACTION_TYPES as readonly string[]).includes(type);
}
