import { isObject } from '../../is-object';
import type { ToMillis } from './ban';

/** The collection of the relay's credentials (ADR 0020). */
export const RELAY_COLLECTION = 'relay';
/** The one document in it: Cloudflare's TURN server. */
export const RELAY_DOC_ID = 'turn';

/**
 * The TURN relay's credentials as `relay/turn` stores them (ADR 0020):
 * where the relay is, and the short-lived name and password that let a
 * device use it until `expireAt`, in ms. Only the functions write it
 * (`refreshRelay`, every 30 minutes); the game reads it with
 * {@link parseRelayCredentials} before it connects to another device.
 * Flat, since Firestore here holds no arrays in arrays.
 */
export interface RelayCredentials {
  /** The relay's `turn:` and `turns:` URLs. */
  urls: string[];
  username: string;
  credential: string;
  /** When the credentials stop working. */
  expireAt: number;
}

/**
 * `relay/turn` - null for no document, or one the relay cannot be used
 * with: no URL, no name or password, or no readable expiry.
 */
export function parseRelayCredentials(
  data: unknown,
  toMillis: ToMillis
): RelayCredentials | null {
  if (!isObject(data) || !Array.isArray(data['urls'])) {
    return null;
  }
  const urls = data['urls'].filter(
    (url): url is string => typeof url === 'string'
  );
  const username = data['username'];
  const credential = data['credential'];
  const expireAt = toMillis(data['expireAt']);
  if (
    urls.length === 0 ||
    typeof username !== 'string' ||
    username === '' ||
    typeof credential !== 'string' ||
    credential === '' ||
    expireAt === null
  ) {
    return null;
  }
  return { urls, username, credential, expireAt };
}
