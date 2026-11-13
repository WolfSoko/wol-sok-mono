/**
 * Fails a Hosting deploy whose release did not go live (#3073): fetches the
 * site's `/` until it serves the built `index.html` named by the Firebase
 * config's `hosting.public`, for up to two minutes.
 *
 * Usage: tsx --tsconfig tools/tsconfig.tools.json tools/deploy/check-live-index.ts <firebase-config> <site-url>
 * `LIVE_CHECK_PAUSE_MS` overrides the pause between attempts (the specs set 0).
 */
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  builtIndexPath,
  checkLiveIndex,
  FirebaseConfig,
  LiveAnswer,
} from './live-index';

const USAGE_EXIT_CODE = 2;
const FETCH_TIMEOUT_MS = 15_000;

async function fetchLive(url: string): Promise<LiveAnswer> {
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache' },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return {
    status: response.status,
    body: await response.text(),
    lastModified: response.headers.get('last-modified'),
  };
}

function pauseOverride(): number | undefined {
  const ms = Number(process.env['LIVE_CHECK_PAUSE_MS'] || NaN);
  return ms >= 0 ? ms : undefined;
}

async function main(): Promise<number> {
  const [configPath, siteUrl] = process.argv.slice(2);
  if (!configPath || !siteUrl) {
    console.error('Usage: check-live-index.ts <firebase-config> <site-url>');
    return USAGE_EXIT_CODE;
  }
  const config = JSON.parse(readFileSync(configPath, 'utf8')) as FirebaseConfig;
  const indexPath = builtIndexPath(config);
  const built = readFileSync(indexPath, 'utf8');
  const result = await checkLiveIndex(siteUrl, built, {
    fetchLive,
    pause: sleep,
    log: console.log,
    now: Date.now,
    pauseMs: pauseOverride(),
  });
  if (!result.ok) {
    console.log(`::error::${result.message}`);
    return 1;
  }
  console.log(
    `${siteUrl} serves the built ${indexPath} (attempt ${result.attempt}).`
  );
  return 0;
}

// No top-level await: outside a `"type": "module"` package tsx emits CommonJS.
void main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.log(
      `::error::Live index check could not run: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
);
