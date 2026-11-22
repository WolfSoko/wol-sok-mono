import { hasOnlyCommandKeys } from './command-documents';
import { isObject } from '../is-object';

/**
 * The Play Games sign-in (#3175 step 2): the Android app hands the game a
 * one-time server auth code of Play Games in the launch URL's fragment,
 * the game writes it into a command document, and a trigger links the
 * Play Games player to the game account (`playGamesLinks/{playerId}`),
 * answering a custom token for the account it settled on. Shared by the
 * game and the functions. Pure.
 */

/** The command collection the game writes a code into. */
export const PLAY_GAMES_SIGN_INS = 'playGamesSignIns';

/** The links of Play Games players to game accounts, functions only. */
export const PLAY_GAMES_LINKS = 'playGamesLinks';

/** The key of the launch URL's fragment the app puts the code under. */
export const PLAY_GAMES_FRAGMENT_KEY = 'play-games';

/** The longest code the rules take; Google's are about 100 characters. */
export const PLAY_GAMES_CODE_MAX = 512;

/** The field beside `result` the trigger writes the custom token into. */
export const PLAY_GAMES_TOKEN_KEY = 'token';

/** The custom claim of an account a Play Games player is linked to. */
export const PLAY_GAMES_CLAIM = 'playGames';

/**
 * Why a Play Games sign-in was refused: the player is linked to another
 * account while the writer has a sign-in of its own, or Google refused
 * the code (expired, used, or for another client).
 */
export const PLAY_GAMES_SIGN_IN_ERRORS = [
  'linked-elsewhere',
  'play-games-refused',
] as const;

export type PlayGamesSignInError = (typeof PLAY_GAMES_SIGN_IN_ERRORS)[number];

/** A Play Games sign-in without its envelope. */
export interface PlayGamesSignIn {
  code: string;
}

const SIGN_IN_KEYS = ['code', PLAY_GAMES_TOKEN_KEY];

/**
 * Reads a Play Games sign-in - null for anything that is not exactly one:
 * a missing, empty or too long code, or an extra field. The stored
 * document's own fields (envelope, result, token) may come along.
 */
export function parsePlayGamesSignIn(value: unknown): PlayGamesSignIn | null {
  if (!isObject(value) || !hasOnlyCommandKeys(value, SIGN_IN_KEYS)) {
    return null;
  }
  const { code } = value;
  return typeof code === 'string' &&
    code.length > 0 &&
    code.length <= PLAY_GAMES_CODE_MAX
    ? { code }
    : null;
}

/**
 * The code in a launch URL's fragment (`#play-games=<code>`), null without
 * one - or with one the rules would refuse.
 */
export function playGamesCodeOf(hash: string): string | null {
  const code = new URLSearchParams(hash.replace(/^#/, '')).get(
    PLAY_GAMES_FRAGMENT_KEY
  );
  return code !== null && parsePlayGamesSignIn({ code }) !== null ? code : null;
}
