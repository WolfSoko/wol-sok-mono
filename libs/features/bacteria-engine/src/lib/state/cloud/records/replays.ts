/**
 * What kind of match a stored replay (`replays/{id}`, ADR 0011) is -
 * derived by the functions, never claimed by the client.
 */
export const REPLAY_KINDS = ['online', 'computer', 'daily', 'endless'] as const;

export type ReplayKind = (typeof REPLAY_KINDS)[number];

/**
 * Where a stored replay stands (ADR 0011): `submitted` is a local match,
 * `waiting` and `agreed` online ones with one or both reports.
 */
export const REPLAY_STATES = [
  'submitted',
  'waiting',
  'agreed',
  'disputed',
  'verified',
  'unverified',
  'balance-mismatch',
] as const;

export type ReplayState = (typeof REPLAY_STATES)[number];
