import type { Replay } from '../state/replay';
import { unpackReplay } from '../state/replay-pack';

/** What a public replay id looks like - checked before anything is fetched. */
const PUBLIC_ID = /^[A-Za-z0-9_-]{6,40}$/;

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
 * A public replay, as `publicSite` serves it at
 * `/replays/{publicId}/replay.json` (ADR 0011): the packed replay, without
 * room, match number or app version. No Firebase and no account - the
 * viewer under `/watch` reads it like anyone could.
 *
 * Null for a replay that is not there (404), was taken down (410) or cannot
 * be read. Any other failure - offline, a server error - rejects, so the
 * viewer can offer to try again.
 */
export async function fetchPublicReplay(
  publicId: string,
  options: PublicReplayOptions = {}
): Promise<Replay | null> {
  if (!PUBLIC_ID.test(publicId)) {
    return null;
  }
  const fetchJson = options.fetch ?? globalThis.fetch.bind(globalThis);
  const response = await fetchJson(
    `${options.base ?? ''}/replays/${publicId}/replay.json`,
    { headers: { accept: 'application/json' } }
  );
  if (response.status === 404 || response.status === 410) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`The replay ${publicId} answered ${response.status}`);
  }
  try {
    return unpackReplay(await response.json());
  } catch {
    return null;
  }
}
