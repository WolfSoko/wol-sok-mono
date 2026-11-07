/**
 * Where a player's data lives, and how a deleted account leaves it (ADR
 * 0012, owner's decisions of 2026-10-26). The one list of it: every
 * collection, document and Realtime Database node the game or the
 * functions write, each with the part of the erasure that goes through it.
 * `player-data.spec.ts` fails on a path of `firestore.rules` or
 * `database.rules.json` missing here; a collection only the functions
 * write gets its entry by hand.
 */

/** The parts of the erasure, one `onDelete` trigger each (`erasePart`). */
export const ERASURE_PARTS = ['account', 'replays', 'social'] as const;
export type ErasurePart = (typeof ERASURE_PARTS)[number];

/** The parts of an entry every kind has. */
interface Place {
  /** The store of the game's data it lives in. */
  store: 'firestore' | 'realtime';
  /**
   * The path, `{uid}` for the player and other `{name}` wildcards: a
   * document path in Firestore, a node path in the Realtime Database.
   */
  path: string;
}

/** An entry some part of the erasure goes through. */
interface Erased extends Place {
  part: ErasurePart;
}

/** An entry `eraseListed` deletes by its path alone. */
interface Listed extends Erased {
  /**
   * `doc`: the document `path` names (`{uid}` its id); `tree`: that
   * document and everything below it; `node`: the Realtime Database node.
   */
  erase: 'doc' | 'tree' | 'node';
}

/** Every document of a collection whose `field` holds the uid. */
export interface ByField extends Erased {
  erase: 'field';
  field: string;
  /** The field is an array, and holds the uid among others. */
  contains?: true;
}

/**
 * Erased - deleted or anonymised - by its part's own code: it needs reads,
 * a filter, a transaction or an order the table cannot say.
 */
interface Custom extends Erased {
  erase: 'custom';
  /** What the code does, and where it is. */
  how: string;
}

/** Holds no player data, or stays on purpose. */
interface Kept extends Place {
  erase: 'keep';
  why: string;
}

export type PlayerData = Listed | ByField | Custom | Kept;

/** The entries `eraseListed` runs: deleted by their path or a field. */
export type Plain = Listed | ByField;

export const PLAYER_DATA: readonly PlayerData[] = [
  // Social and personal data (`social/delete-player.ts`).
  {
    store: 'firestore',
    path: 'players/{uid}',
    part: 'social',
    erase: 'tree',
  },
  {
    store: 'firestore',
    path: 'players/{other}/{list}/{uid}',
    part: 'social',
    erase: 'custom',
    how: 'deletePlayerSocial: the player in the friends, requests and challenges of every other player they list or the listedBy mirror names; a collection-group query cannot find a bare document id.',
  },
  {
    store: 'firestore',
    path: 'profiles/{uid}',
    part: 'social',
    erase: 'doc',
  },
  { store: 'firestore', path: 'queue/{uid}', part: 'social', erase: 'doc' },
  {
    store: 'firestore',
    path: 'invites/{token}',
    part: 'social',
    erase: 'field',
    field: 'from',
  },
  {
    store: 'firestore',
    path: 'rooms/{code}',
    part: 'social',
    erase: 'custom',
    how: "deletePlayerSocial (openRoomsOf): the rooms nobody took that they host or answered; a taken room's stub stays until it expires (6 hours), the other player's report is checked against it.",
  },
  { store: 'realtime', path: 'status/{uid}', part: 'social', erase: 'node' },
  {
    store: 'realtime',
    path: 'connections/{uid}',
    part: 'social',
    erase: 'node',
  },
  {
    store: 'realtime',
    path: 'statusReaders/{uid}',
    part: 'social',
    erase: 'node',
  },
  {
    store: 'realtime',
    path: 'statusReaders/{other}/{uid}',
    part: 'social',
    erase: 'custom',
    how: 'deletePlayerSocial: the entry in the mirror of every other player found in their lists.',
  },
  {
    store: 'realtime',
    path: 'listedBy/{uid}',
    part: 'social',
    erase: 'node',
  },
  {
    store: 'realtime',
    path: 'listedBy/{other}/{uid}',
    part: 'social',
    erase: 'custom',
    how: 'deletePlayerSocial: the entry in the mirror of every other player found in their lists.',
  },

  // Boards, bans, audit and the account count (`admin/accounts.ts`,
  // `boards/delete-player.ts`).
  {
    store: 'firestore',
    path: 'boardMembers/{uid}',
    part: 'account',
    erase: 'doc',
  },
  {
    store: 'firestore',
    path: 'boards/{boardId}/entries/{entryId}',
    part: 'account',
    erase: 'custom',
    how: 'deleteAccount (boardRefsOf, boards/delete-player.ts): the entry on every board boardMembers/{uid} names; entries carry no uid.',
  },
  {
    store: 'firestore',
    path: 'boards/{boardId}',
    part: 'account',
    erase: 'custom',
    how: 'rebuildTop takes the deleted entries off the top document.',
  },
  {
    store: 'firestore',
    path: 'dailyRuns/{day}_{uid}',
    part: 'account',
    erase: 'custom',
    how: 'deleteAccount (boardRefsOf, boards/delete-player.ts): one per daily board boardMembers/{uid} names.',
  },
  {
    store: 'firestore',
    path: 'endlessRuns/{runId}',
    part: 'account',
    erase: 'field',
    field: 'uid',
  },
  { store: 'firestore', path: 'limits/{uid}', part: 'account', erase: 'doc' },
  {
    store: 'firestore',
    path: 'moderation/{uid}',
    part: 'account',
    erase: 'doc',
  },
  {
    store: 'firestore',
    path: 'bans/{uid}',
    part: 'account',
    erase: 'custom',
    how: "deleteAccount: deleted once a banned account's tombstones are written, so the ban survives the deletion.",
  },
  {
    store: 'realtime',
    path: 'bans/{uid}',
    part: 'account',
    erase: 'custom',
    how: 'deleteAccount: removed with bans/{uid} in Firestore.',
  },
  {
    store: 'firestore',
    path: 'adminAudit/{id}',
    part: 'account',
    erase: 'custom',
    how: 'scrubAudit: the entries about the player keep uid, type, reason and date; before and after are scrubbed.',
  },
  {
    store: 'firestore',
    path: 'adminCommands/{id}',
    part: 'account',
    erase: 'field',
    // Written on a command by board entry once it ran (`runAdminCommand`).
    field: 'target.uid',
  },
  {
    store: 'firestore',
    path: 'pairs/{id}',
    part: 'account',
    erase: 'field',
    field: 'uids',
    contains: true,
  },
  {
    store: 'firestore',
    path: 'stats/{id}',
    part: 'account',
    erase: 'custom',
    how: 'deleteAccount: stats/accounts is lowered once for an account countAccount counted.',
  },
  {
    store: 'firestore',
    path: 'banTombstones/{id}',
    erase: 'keep',
    why: "Keyed by a hash of the Google provider's id, no uid: keeps a ban past the deletion.",
  },

  // Replays (`replays/forget.ts`).
  {
    store: 'firestore',
    path: 'replaySubmissions/{id}',
    part: 'replays',
    erase: 'field',
    field: 'uid',
  },
  {
    store: 'firestore',
    path: 'replayCommands/{id}',
    part: 'replays',
    erase: 'field',
    field: 'uid',
  },
  {
    store: 'firestore',
    path: 'replays/{id}',
    part: 'replays',
    erase: 'custom',
    how: 'forgetReplay: the uid leaves players, seats and optOut; the replay stays for the statistics until its expireAt.',
  },
  {
    store: 'firestore',
    path: 'replays/{id}/reports/{uid}',
    part: 'replays',
    erase: 'custom',
    how: "forgetReplay: deleted in the replay's transaction.",
  },
  {
    store: 'firestore',
    path: 'replays/{id}/blob/{doc}',
    erase: 'keep',
    why: "The match's inputs, without a uid; goes with its replay.",
  },
  {
    store: 'firestore',
    path: 'publicReplays/{id}',
    part: 'replays',
    erase: 'custom',
    how: 'anonymisePublic: the public copies lose the uid and show the seat without a name.',
  },

  // Data without a player, or kept until it expires.
  {
    store: 'firestore',
    path: 'rankedReplays/{replayId}',
    erase: 'keep',
    why: 'A marker per ranked replay id, without a uid.',
  },
  {
    store: 'firestore',
    path: 'rankedRooms/{code}',
    erase: 'keep',
    why: "A room's summed ticks, without a uid; expires after 12 hours.",
  },
  {
    store: 'firestore',
    path: 'counters/{day}',
    erase: 'keep',
    why: "The day's totals and budgets, without a uid.",
  },
  {
    store: 'firestore',
    path: 'adminStats/{id}',
    erase: 'keep',
    why: 'Totals for the admin overview, without a uid.',
  },
  {
    store: 'firestore',
    path: 'levelStats/{id}',
    erase: 'keep',
    why: 'Per level and bot difficulty, without a uid (ADR 0016).',
  },
  {
    store: 'firestore',
    path: 'replayCandidates/{day}',
    erase: 'keep',
    why: "The gallery's runners-up of a day: replay ids and scores, without a uid.",
  },
];

/** The entries of `part` that `eraseListed` deletes by path or field. */
export function plainEntriesOf(part: ErasurePart): Plain[] {
  return PLAYER_DATA.filter(
    (entry): entry is Plain =>
      entry.erase !== 'keep' && entry.erase !== 'custom' && entry.part === part
  );
}
