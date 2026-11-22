import type { CommandResult } from '@wolsok/feat-shared-bacteria-engine/cloud';

/**
 * The Play Games sign-in of the Android app (#3175): hands the one-time
 * code the app got from Play Games to the functions and waits for their
 * answer. Only with a project; without one there is nothing to sign in to.
 */
export interface GamePlayGames {
  /**
   * Sends `code` in the first player's name and answers what the functions
   * made of it - null when no answer came in time (no function deployed,
   * offline) or the command could not be written.
   */
  signIn(code: string): Promise<PlayGamesAnswer | null>;
}

/** A custom token of the functions, and the uid it signs in to. */
export interface PlayGamesToken {
  value: string;
  uid: string;
}

/** The functions' answer to a Play Games sign-in. */
export type PlayGamesAnswer = CommandResult & {
  /**
   * Why not: a `PlayGamesSignInError` of the engine's `/cloud` entry, or
   * the runner's own (`not-writer`, `malformed`, `internal`).
   */
  error?: string;
  /**
   * The token for the account the player settled on - null where the
   * session needs none (a Google account keeps its own).
   */
  token: PlayGamesToken | null;
  /** The player the sign-in was written for: the token is for their session. */
  writer: string;
};
