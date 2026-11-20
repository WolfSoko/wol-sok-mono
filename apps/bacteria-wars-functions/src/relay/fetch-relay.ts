import {
  type RelayEntry,
  relayCredentialsUrl,
  relayEntry,
} from '@wolsok/feat-shared-bacteria-engine/cloud';

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

/** The longest wait for Cloudflare's answer. */
const FETCH_TIMEOUT_MS = 10_000;

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
 * Fresh credentials for the relay, valid `ttlSeconds` - throws when
 * Cloudflare refuses or answers no TURN server, never with the token or
 * Cloudflare's text in the message.
 */
export async function fetchRelay(
  key: TurnKey,
  ttlSeconds: number,
  fetchFn: typeof fetch
): Promise<RelayEntry> {
  const response = await fetchFn(relayCredentialsUrl(key.id), {
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
