/**
 * The TURN key of Cloudflare Realtime that hands out the relay's
 * credentials (ADR 0020): its id and its token, as the provisioning tool
 * (`tools-relay:turn-key`) stores them in the secret `CLOUDFLARE_TURN_KEY`.
 * The token can only hand out credentials, never change the account.
 */
export interface TurnKey {
  id: string;
  token: string;
}

/** The TURN server the game connects through, as `relay/turn` keeps it. */
export interface RelayEntry {
  urls: string[];
  username: string;
  credential: string;
}

/** Where Cloudflare hands out credentials for a key. */
const GENERATE_URL = (keyId: string) =>
  `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`;

/** The longest wait for Cloudflare's answer. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * A URL on port 53, which browsers block: without trickle ICE, which the
 * game does not use, it only times out (Cloudflare's advice).
 */
const PORT_53 = /:53(\?|$)/;

/** The `CLOUDFLARE_TURN_KEY` secret's value, which names no part of it on failure. */
export function parseTurnKey(secret: string): TurnKey {
  let value: unknown = null;
  try {
    value = JSON.parse(secret);
  } catch {
    // Reported below without the value.
  }
  const { id, token } = (value ?? {}) as Record<string, unknown>;
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

/**
 * The TURN server in Cloudflare's `generate-ice-servers` answer, its URLs
 * on port 53 dropped - null when it has none left, or no credentials.
 * The STUN entry is left out: the game has its own STUN servers.
 */
export function relayEntry(answer: unknown): RelayEntry | null {
  const servers = (answer as { iceServers?: unknown } | null)?.iceServers;
  if (!Array.isArray(servers)) {
    return null;
  }
  for (const server of servers as Record<string, unknown>[]) {
    const { username, credential } = server ?? {};
    const listed = server?.['urls'];
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
 * Fresh credentials for the relay, valid `ttlSeconds` - throws when
 * Cloudflare refuses or answers no TURN server, never with the token or
 * Cloudflare's text in the message.
 */
export async function fetchRelay(
  key: TurnKey,
  ttlSeconds: number,
  fetchFn: typeof fetch
): Promise<RelayEntry> {
  const response = await fetchFn(GENERATE_URL(key.id), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: ttlSeconds }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Cloudflare refused the TURN credentials (${response.status}).`
    );
  }
  const entry = relayEntry(await response.json());
  if (entry === null) {
    throw new Error('Cloudflare answered no TURN server.');
  }
  return entry;
}
