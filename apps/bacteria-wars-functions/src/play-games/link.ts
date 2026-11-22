/**
 * Which game account a Play Games player settles on (#3175 step 2): one
 * Play Games player is one game account, `playGamesLinks/{playerId}`.
 * Pure: the trigger reads the facts, this decides.
 */

/** What the trigger knows when it settles a link. */
export interface LinkFacts {
  /** The writer of the sign-in: the account that plays in the app now. */
  writer: { uid: string; hasProvider: boolean };
  /**
   * The account the player is linked to, null without a link - or with a
   * link to an account that is gone, which counts as none.
   */
  linkedUid: string | null;
}

/**
 * - `link`: no link yet, the writer gets it;
 * - `keep`: the writer is linked already;
 * - `take-over`: the writer is a guest, and the player's account (made on
 *   another phone, or before a sign-out) takes over from it;
 * - `refuse`: the writer has a sign-in of its own (Google) while the
 *   player is linked to another account, which neither may take.
 */
export type LinkOutcome =
  | { kind: 'link' | 'keep' | 'take-over'; uid: string }
  | { kind: 'refuse' };

export function settleLink({ writer, linkedUid }: LinkFacts): LinkOutcome {
  if (linkedUid === null) {
    return { kind: 'link', uid: writer.uid };
  }
  if (linkedUid === writer.uid) {
    return { kind: 'keep', uid: writer.uid };
  }
  return writer.hasProvider
    ? { kind: 'refuse' }
    : { kind: 'take-over', uid: linkedUid };
}
