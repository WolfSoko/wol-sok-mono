import {
  type RelayEntry,
  relayCredentialsUrl,
  relayEntry,
  type TurnKey,
} from '@wolsok/feat-shared-bacteria-engine/cloud';

/** The longest wait for Cloudflare's answer. */
const FETCH_TIMEOUT_MS = 10_000;

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
  // Its own text, never the body's, which a SyntaxError would quote.
  const answer: unknown = await response.json().catch(() => {
    throw new Error('Cloudflare answered no JSON.');
  });
  const entry = relayEntry(answer);
  if (entry === null) {
    throw new Error('Cloudflare answered no TURN server.');
  }
  return entry;
}
