/**
 * Why a board entry is hidden (`hiddenBy` of
 * `boards/{boardId}/entries/{entryId}`, ADR 0012): a ban, the owner, or the
 * player's opt-out. Any reason hides it.
 */
export const HIDE_REASONS = ['ban', 'admin', 'optout'] as const;

export type HideReason = (typeof HIDE_REASONS)[number];
