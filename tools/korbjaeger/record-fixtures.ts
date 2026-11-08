/**
 * Records the DBB responses of `FIXTURE_REQUESTS` into a folder outside the
 * workspace, raw: they hold real children's names, so they never enter the
 * repo. `anonymise-fixtures.ts` turns them into the lib's fixtures.
 *
 *   NODE_USE_ENV_PROXY=1 npx tsx tools/korbjaeger/record-fixtures.ts <raw-dir>
 *
 * Polite on purpose: one request at a time, a pause between them, and a
 * User-Agent that names the app.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import {
  DBB_BASE_URL,
  dbbHttpRequest,
  type DbbRequest,
} from '../../libs/features/basketball-data/src/lib/dbb/dbb-request';
import { FIXTURE_REQUESTS } from './fixture-requests';
import { rawDirOutsideWorkspace } from './raw-dir';

const USER_AGENT = 'Korbjaeger-dev (+https://korb.wolsok.de)';
const PAUSE_MS = 1000;

async function main(): Promise<void> {
  const rawDir = rawDirOutsideWorkspace(process.argv[2]);
  mkdirSync(rawDir, { recursive: true });
  for (const fixture of FIXTURE_REQUESTS) {
    const response = await fetchDbb(fixture.request);
    writeFileSync(
      join(rawDir, `${fixture.name}.json`),
      JSON.stringify(response, null, 2)
    );
    console.log(`recorded ${fixture.name}`);
    await pause(PAUSE_MS);
  }
}

async function fetchDbb(request: DbbRequest): Promise<unknown> {
  const http = dbbHttpRequest(request);
  const response = await fetch(`${DBB_BASE_URL}/${http.path}`, {
    method: http.method,
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/json' },
    body: http.method === 'POST' ? JSON.stringify(http.body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${http.method} ${http.path}: HTTP ${response.status}`);
  }
  return response.json();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
