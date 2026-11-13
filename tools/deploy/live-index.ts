import { posix } from 'node:path';

/** What the live site answered to one fetch. */
export interface LiveAnswer {
  status: number;
  body: Buffer;
  lastModified: string | null;
}

export interface LiveCheckDeps {
  fetchLive: (url: string) => Promise<LiveAnswer>;
  pause: (ms: number) => Promise<unknown>;
  log: (line: string) => void;
  /** The clock for the cache-busting query. */
  now: () => number;
  attempts?: number;
  pauseMs?: number;
}

export type LiveCheckResult =
  | { ok: true; attempt: number }
  | { ok: false; message: string };

/** Hosting puts a release live within seconds; two minutes leave room. */
const ATTEMPTS = 12;
const PAUSE_MS = 10_000;
const HTTP_OK = 200;
/** Enough of a differing line to name the chunk it points to. */
const LINE_EXCERPT = 160;

/**
 * Fetches the live site until it serves the built `index.html` byte for
 * byte, or the attempts run out (#3073): a Hosting deploy that reported
 * success but left the previous release live (#3058) fails the release.
 */
export async function checkLiveIndex(
  siteUrl: string,
  built: Buffer,
  {
    fetchLive,
    pause,
    log,
    now,
    attempts = ATTEMPTS,
    pauseMs = PAUSE_MS,
  }: LiveCheckDeps
): Promise<LiveCheckResult> {
  let mismatch = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await pause(pauseMs);
    mismatch = await mismatchOf(built, () =>
      fetchLive(cacheBusted(siteUrl, now()))
    );
    if (!mismatch) return { ok: true, attempt };
    log(`Live index check, attempt ${attempt} of ${attempts}: ${mismatch}`);
  }
  return {
    ok: false,
    message: `${siteUrl} does not serve the built index.html after ${attempts} attempts: ${mismatch}`,
  };
}

/** Why the live answer is not the built file, or '' when it is. */
async function mismatchOf(
  built: Buffer,
  fetchLive: () => Promise<LiveAnswer>
): Promise<string> {
  let live: LiveAnswer;
  try {
    live = await fetchLive();
  } catch (error) {
    return `fetch failed (${error instanceof Error ? error.message : String(error)})`;
  }
  if (live.status !== HTTP_OK) return `status ${live.status}`;
  if (live.body.equals(built)) return '';
  return [
    `last-modified ${live.lastModified ?? 'none'}`,
    `${live.body.length} bytes live, ${built.length} bytes built`,
    firstDifference(live.body.toString('utf8'), built.toString('utf8')),
  ].join('; ');
}

function cacheBusted(siteUrl: string, time: number): string {
  const url = new URL(siteUrl);
  url.searchParams.set('deploy-check', String(time));
  return url.toString();
}

function firstDifference(live: string, built: string): string {
  const liveLines = live.split('\n');
  const builtLines = built.split('\n');
  const index = liveLines.findIndex((line, i) => line !== builtLines[i]);
  const at = index === -1 ? liveLines.length : index;
  return `first difference in line ${at + 1}: live ${excerpt(liveLines[at])}, built ${excerpt(builtLines[at])}`;
}

/** The line quoted and escaped, so a `\r` or trailing space shows. */
function excerpt(line: string | undefined): string {
  return line === undefined
    ? '(none)'
    : JSON.stringify(line.slice(0, LINE_EXCERPT));
}

interface HostingEntry {
  public?: unknown;
  [key: string]: unknown;
}

/** The shape of a root `firebase.<x>.json` this check reads. */
export interface FirebaseConfig {
  hosting?: HostingEntry | HostingEntry[];
}

/** The built `index.html` the config's one Hosting entry deploys. */
export function builtIndexPath(config: FirebaseConfig): string {
  const { hosting } = config;
  const entries = Array.isArray(hosting) ? hosting : hosting ? [hosting] : [];
  if (entries.length !== 1) {
    throw new Error(
      `Expected exactly one hosting entry in the Firebase config, found ${entries.length}.`
    );
  }
  const publicDir = entries[0].public;
  if (typeof publicDir !== 'string' || publicDir === '') {
    throw new Error(
      'The hosting entry of the Firebase config names no public folder.'
    );
  }
  return posix.join(publicDir, 'index.html');
}
