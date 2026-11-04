import { BALANCE_VERSION } from './game-balance';
import { Replay } from './replay';
import { replayFromBytes, replayToBytes } from './replay-pack';

/** The key of a run in the hash of a link: `#ghost=...`. */
const HASH_KEY = 'ghost';

/**
 * A link to the game that carries a run as a ghost to fight: the run packed
 * for the public (`state/replay-pack.ts`) and written in base64url into the
 * hash, so it never reaches a server and works wherever the game is served
 * from.
 */
export async function replayLink(
  base: string,
  replay: Replay
): Promise<string> {
  const packed = await replayToBytes(replay, { forPublic: true });
  return `${base.split('#')[0]}#${HASH_KEY}=${toBase64Url(packed)}`;
}

/**
 * The run a link's hash carries, null for a hash without one, or with one
 * that is damaged or from another version of the game or its balance.
 * Version 1 links from before replay version 2 still carry their run, and
 * version 3 ones a run with evolution in it.
 */
export async function replayFromHash(hash: string): Promise<Replay | null> {
  const payload = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY);
  if (payload == null || payload === '') {
    return null;
  }
  try {
    // Null as well for a format this client does not know.
    const replay = await replayFromBytes(fromBase64Url(payload));
    // A ghost of another balance would not play out as it was played.
    return replay?.header.balanceVersion === BALANCE_VERSION ? replay : null;
  } catch {
    return null;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
