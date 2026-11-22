/**
 * Which game account a Play Games player settles on (#3175 step 2): one
 * Play Games player is one game account, `playGamesLinks/{playerId}`.
 * Pure: the trigger reads the facts, this decides.
 */

/** An account as the decision sees it. */
export interface LinkAccount {
  uid: string;
  /** True when it has a sign-in provider of its own (Google). */
  hasProvider: boolean;
}

/** What the trigger knows when it settles a link. */
export interface LinkFacts {
  /** The writer of the sign-in: the account that plays in the app now. */
  writer: LinkAccount;
  /**
   * The account the player is linked to, null without a link - or with a
   * link to an account that is gone, which counts as none.
   */
  linked: LinkAccount | null;
}

/**
 * - `link`: no link yet, the writer gets it;
 * - `keep`: the writer is linked already;
 * - `take-over`: the writer is a guest, and the player's account (made on
 *   another phone, or before a sign-out) takes over from it;
 * - `move`: the writer signed in with Google, and the player's account has
 *   no provider: a Google account outranks it, as it outranks a guest - in
 *   the usual case the Google account has just adopted it on this phone;
 * - `refuse`: the writer and the player's account both have a provider
 *   (two Google accounts), and neither may take the other's player.
 */
export type LinkOutcome =
  | { kind: 'link' | 'keep' | 'take-over'; uid: string }
  | { kind: 'move'; uid: string; from: string }
  | { kind: 'refuse' };

export function settleLink({ writer, linked }: LinkFacts): LinkOutcome {
  if (linked === null) {
    return { kind: 'link', uid: writer.uid };
  }
  if (linked.uid === writer.uid) {
    return { kind: 'keep', uid: writer.uid };
  }
  if (!writer.hasProvider) {
    return { kind: 'take-over', uid: linked.uid };
  }
  return linked.hasProvider
    ? { kind: 'refuse' }
    : { kind: 'move', uid: writer.uid, from: linked.uid };
}
