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

/** The functions' answer to a Play Games sign-in. */
export interface PlayGamesAnswer {
  ok: boolean;
  /** Why not: `linked-elsewhere`, `play-games-refused`, … */
  error?: string;
  /** The custom token for the account the player settled on. */
  token: string | null;
}
