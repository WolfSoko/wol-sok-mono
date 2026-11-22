import { hasOnlyCommandKeys } from './command-documents';
import { isObject } from '../is-object';

/**
 * A Google account adopting a Play-only account (#3187): the Play-only
 * session A releases itself (`playGamesReleases/{A}`) with a nonce made in
 * the tab right before it signs in to the Google account B that played
 * elsewhere; once A's progress landed in B under the same nonce, the tab
 * writes the adoption (`playGamesAdoptions/{id}`), and a trigger moves A's
 * Play Games links to B. Shared by the game and the functions. Pure.
 */

/** Where a Play-only account releases itself, by its uid; nobody reads it. */
export const PLAY_GAMES_RELEASES = 'playGamesReleases';

/** The command collection the adopting Google account writes into. */
export const PLAY_GAMES_ADOPTIONS = 'playGamesAdoptions';

/** How long a release stays usable after it was written: 10 minutes. */
export const ADOPTION_WINDOW_MS = 10 * 60_000;

/** The nonce's length: 128 random bits as lower-case hex. */
export const PLAY_GAMES_NONCE_LENGTH = 32;

const NONCE = new RegExp(`^[0-9a-f]{${PLAY_GAMES_NONCE_LENGTH}}$`);

/** A uid as the rules take it (`isUidTarget`). */
const UID = /^[A-Za-z0-9]{1,128}$/;

/**
 * Why an adoption moved nothing: no fresh release of `from` with this
 * nonce, a writer that is gone or has no Google sign-in, either account
 * banned, or a storage document of `from` whose adoption the writer's does
 * not list (its progress has not landed).
 */
export type PlayGamesAdoptionError =
  | 'no-release'
  | 'no-account'
  | 'not-google'
  | 'banned'
  | 'not-adopted';

/** A Play Games adoption without its envelope. */
export interface PlayGamesAdoption {
  /** The Play-only account adopted. */
  from: string;
  /** The release's nonce, also the id the progress was adopted under. */
  nonce: string;
}

const ADOPTION_KEYS = ['from', 'nonce'];

/** True for a nonce as the tab makes it. */
export function isAdoptionNonce(value: unknown): value is string {
  return typeof value === 'string' && NONCE.test(value);
}

/**
 * Reads a Play Games adoption - null for anything that is not exactly one:
 * a `from` that is no uid, a nonce of another shape, or an extra field. The
 * stored document's own fields (envelope, result) may come along.
 */
export function parsePlayGamesAdoption(
  value: unknown
): PlayGamesAdoption | null {
  if (!isObject(value) || !hasOnlyCommandKeys(value, ADOPTION_KEYS)) {
    return null;
  }
  const { from, nonce } = value;
  return typeof from === 'string' && UID.test(from) && isAdoptionNonce(nonce)
    ? { from, nonce }
    : null;
}
