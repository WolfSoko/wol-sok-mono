import {
  ADMIN_COMMAND_TYPES,
  type AdminCommandType,
} from '@wolsok/feat-lazy-bac-game/admin-kit';

/** The owner's gallery curation, as `replayCommands` types (ADR 0011). */
export const REPLAY_COMMAND_TYPES = [
  'feature',
  'unfeature',
  'anonymise',
] as const;
export type ReplayCommandType = (typeof REPLAY_COMMAND_TYPES)[number];

/** Curation the owner cannot take back, so it needs a fresh sign-in. */
export const DESTRUCTIVE_REPLAY_TYPES: readonly ReplayCommandType[] = [
  'unfeature',
  'anonymise',
];

/**
 * Everything the owner does, as the audit names it: the admin commands and
 * the curation, which `replayCommand` audits as `replay.<type>`.
 */
export type OwnerActionType = AdminCommandType | `replay.${ReplayCommandType}`;

export const OWNER_ACTION_TYPES: readonly OwnerActionType[] = [
  ...ADMIN_COMMAND_TYPES,
  ...REPLAY_COMMAND_TYPES.map((type) => `replay.${type}` as const),
];

export function isOwnerActionType(type: string): type is OwnerActionType {
  return (OWNER_ACTION_TYPES as readonly string[]).includes(type);
}
