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

/** The TURN server as Cloudflare hands it out and `relay/turn` keeps it. */
export type RelayEntry = Omit<RelayCredentials, 'expireAt'>;

/**
 * Where Cloudflare Realtime hands out credentials for the TURN key
 * `keyId`: a POST with the key's token and `{ ttl }` in seconds.
 */
export function relayCredentialsUrl(keyId: string): string {
  return `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`;
}

/**
 * A URL on port 53, which browsers block: without trickle ICE, which the
 * game does not use, it only times out (Cloudflare's advice).
 */
const PORT_53 = /:53(\?|$)/;

/**
 * The TURN server in Cloudflare's `generate-ice-servers` answer, its URLs
 * on port 53 dropped - null when it has none left, or no credentials.
 * The STUN entry is left out: the game has its own STUN servers.
 */
export function relayEntry(answer: unknown): RelayEntry | null {
  const servers = isObject(answer) ? answer['iceServers'] : null;
  if (!Array.isArray(servers)) {
    return null;
  }
  for (const server of servers) {
    if (!isObject(server)) {
      continue;
    }
    const { username, credential } = server;
    const listed = server['urls'];
    const urls = (Array.isArray(listed) ? listed : [listed]).filter(
      (url): url is string =>
        typeof url === 'string' && /^turns?:/.test(url) && !PORT_53.test(url)
    );
    if (
      urls.length > 0 &&
      typeof username === 'string' &&
      typeof credential === 'string'
    ) {
      return { urls, username, credential };
    }
  }
  return null;
}

/**
 * The TURN key of Cloudflare Realtime that hands out the relay's
 * credentials: its id and its token, as the provisioning tool
 * (`tools-relay:turn-key`) stores them in the secret `CLOUDFLARE_TURN_KEY`.
 * The token can only hand out credentials, never change the account.
 */
export interface TurnKey {
  id: string;
  token: string;
}

/**
 * The `CLOUDFLARE_TURN_KEY` secret's value - throws, naming no part of it,
 * for anything but `{ id, token }` with both non-empty.
 */
export function parseTurnKey(secret: string): TurnKey {
  let value: unknown = null;
  try {
    value = JSON.parse(secret);
  } catch {
    // Reported below without the value.
  }
  const id = isObject(value) ? value['id'] : null;
  const token = isObject(value) ? value['token'] : null;
  if (
    typeof id !== 'string' ||
    id === '' ||
    typeof token !== 'string' ||
    token === ''
  ) {
    throw new Error('CLOUDFLARE_TURN_KEY is no {"id","token"} JSON.');
  }
  return { id, token };
}
