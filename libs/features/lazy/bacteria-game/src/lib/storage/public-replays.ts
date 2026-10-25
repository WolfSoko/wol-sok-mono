import type { Replay } from '../state/replay';
import { replayFromBytes } from '../state/replay-pack';

/**
 * What a public replay id looks like - an auto id of `publicReplays`, as
 * `publicSite` checks it too - checked before anything is fetched.
 */
export const PUBLIC_ID = /^[A-Za-z0-9]{20}$/;

/** Where and how {@link fetchPublicReplay} fetches. */
export interface PublicReplayOptions {
  /**
   * The site the public replays are served from, "" for this one - the
   * shell names `https://bacteria-wars.wolsok.de`.
   */
  base?: string;
  fetch?: typeof globalThis.fetch;
}

/**
 * A public replay as {@link loadPublicReplay} found it: the replay, or why
 * there is none - `not-found` for an id that names none (404, or one that
 * cannot be an id), `removed` for one taken down (410), `unreadable` for an
 * answer that holds no whole replay.
 */
export type PublicReplayAnswer =
  | { replay: Replay }
  | { missing: 'not-found' | 'removed' | 'unreadable' };

/**
 * A public replay, as `publicSite` serves it at
 * `/replays/{publicId}/replay.json` (ADR 0011): `{ bytes }`, the packed
 * public replay (without room, match number or app version) as base64,
 * which `replayFromBytes` reads like a stored one. No Firebase and no
 * account - the viewer under `/watch` reads it like anyone could.
 *
 * Any other failure - offline, a server error - rejects, so the viewer can
 * offer to try again.
 */
export async function loadPublicReplay(
  publicId: string,
  options: PublicReplayOptions = {}
): Promise<PublicReplayAnswer> {
  if (!PUBLIC_ID.test(publicId)) {
    return { missing: 'not-found' };
  }
  const fetchJson = options.fetch ?? globalThis.fetch.bind(globalThis);
  const response = await fetchJson(
    `${options.base ?? ''}/replays/${publicId}/replay.json`,
    { headers: { accept: 'application/json' } }
  );
  if (response.status === 404) {
    return { missing: 'not-found' };
  }
  if (response.status === 410) {
    return { missing: 'removed' };
  }
  if (!response.ok) {
    throw new Error(`The replay ${publicId} answered ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { missing: 'unreadable' };
  }
  const bytes = bytesOf(body);
  const replay = bytes === null ? null : await replayFromBytes(bytes);
  return replay === null ? { missing: 'unreadable' } : { replay };
}

/**
 * The public replay - null for one that is not there (404), was taken
 * down (410) or cannot be read. See {@link loadPublicReplay}, which tells
 * those apart.
 */
export async function fetchPublicReplay(
  publicId: string,
  options: PublicReplayOptions = {}
): Promise<Replay | null> {
  const answer = await loadPublicReplay(publicId, options);
  return 'replay' in answer ? answer.replay : null;
}

/** The decoded `bytes` of the answer - null for anything else. */
function bytesOf(body: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const encoded = (body as Record<string, unknown>)['bytes'];
  if (typeof encoded !== 'string') {
    return null;
  }
  try {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}
