/** A declared attempt as the player reads it back (ADR 0012). */
export interface DeclaredAttempt {
  id: string;
  /** The server's time of the declaration, in ms. */
  at: number;
  /**
   * True once the functions marked it `void` (its submission dropped on the
   * server's side): it never ranks, and a daily one may be declared again.
   */
  void: boolean;
}

/** A declaration the server took: whose, and its server time. */
export interface Declaration {
  uid: string;
  /** `at`, read back from the server, in ms - the seed comes from it. */
  at: number;
}

/** Why a declaration did not come to a ranked match. */
export type DeclarationMiss =
  /** The attempt is declared already, and not void: try the next one. */
  | 'taken'
  /**
   * Not sure it counted: offline, refused, or too slow - it may still have
   * committed on the server, where it then counts as used.
   */
  | 'failed';

/**
 * Declared attempts of ranked daily and endless matches (ADR 0012), in
 * `players/{uid}/attempts/{attemptId}` = `{ at, expireAt }`, of whoever
 * plays: only they read and create them, the rules check the ids, their
 * order and the UTC day, and `at == request.time`. Asked of
 * `GameCloud.ranked()` - null without the game's project, where nothing is
 * ranked.
 */
export interface GameRanked {
  /**
   * The attempts among `ids` the player has declared - null when they
   * could not be read, as offline, where ranked play cannot start anyway.
   */
  declared(ids: readonly string[]): Promise<DeclaredAttempt[] | null>;
  /**
   * Declares an attempt: inside a transaction, which fails offline instead
   * of waiting in the cache, created - or, for a void daily attempt,
   * declared again in its place - with the server's time and an `expireAt`
   * 31 days ahead; then read back from the server for `at`. Gives up after
   * `DECLARE_TIMEOUT_MS` in all.
   */
  declare(attemptId: string): Promise<Declaration | DeclarationMiss>;
}

/** How long a declaration may take, the transaction and the read-back. */
export const DECLARE_TIMEOUT_MS = 3_000;
