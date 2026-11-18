/**
 * What the owner's actions tell a player (ADR 0012), the `type` of
 * `players/{uid}/notices/{id}`: written by the functions, read by the game.
 */
export const NOTICE_TYPES = [
  'profile-reset',
  'image-removed',
  'board-hidden',
  'banned',
  'unbanned',
] as const;

export type NoticeType = (typeof NOTICE_TYPES)[number];
